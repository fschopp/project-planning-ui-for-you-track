import {
  appendSchedule,
  Contributor,
  Failure,
  goToOauthPage,
  isFailure,
  ProjectPlan,
  reconstructProjectPlan,
  Schedule,
  scheduleUnresolved,
  SchedulingOptions,
  YouTrackConfig,
  YouTrackIssue,
} from '@fschopp/project-planning-for-you-track';
import { strict as assert } from 'assert';
import S, { DataSignal } from 's-js';
import { deepEquals } from '../../utils/deep-equals';
import { Plain } from '../../utils/s';
import { unreachableCase } from '../../utils/typescript';
import { AlertsCtrl } from '../alerts/alerts-ctrl';
import { ContributorKind } from '../contributor/contributor-model';
import { SettingsCtrl } from '../settings/settings-ctrl';
import { Settings, toNormalizedPlainSettings } from '../settings/settings-model';
import { YouTrackCtrl } from '../you-track/you-track-ctrl';
import { YouTrackMetadata } from '../you-track/you-track-model';
import { App } from './app-model';

const MIN_STATE_CHANGE_DURATION_MS = 60 * 60 * 1000;
const DEFAULT_REMAINING_EFFORT_MS = 0;
const DEFAULT_WAIT_TIME_MS = 0;

/**
 * Resolution is 1 hour.
 */
const SCHEDULING_RESOLUTION_MS = 60 * 60 * 1000;

/**
 * Cannot preempt of split issues that are less than 4 hours ideal time.
 */
const MIN_ACTIVITY_DURATION = 4;

/**
 * Prefix for the IDs of external contributors.
 *
 * No YouTrack user ID must have the same prefix. Given that all
 * [YouTrack IDs are of form "x-y" where both x and y are integers](https://github.com/JetBrains/xodus/blob/master/entity-store/src/main/java/jetbrains/exodus/entitystore/PersistentEntityId.java)
 * (see also the
 * [`EntityId` interface](https://github.com/JetBrains/xodus/blob/master/openAPI/src/main/java/jetbrains/exodus/entitystore/EntityId.java)),
 * anything starting with a non-numeric character should already be safe.
 */
const EXTERNAL_CONTRIBUTOR_ID_PREFIX = '@fschopp/project-planning-ui-for-you-track/';

export enum Action {
  CONNECT = 'connect',
  BUILD_PLAN = 'build',
  UPDATE_PREDICTION = 'update',
  STOP = 'stop',
  NOTHING = 'nothing',
}

/**
 * Project plan together the settings used to compute it.
 */
export interface ExtendedProjectPlan {
  /**
   * The project plan.
   */
  plan: ProjectPlan;

  /**
   * The settings from the user interface.
   */
  settings: Plain<Settings>;

  /**
   * Time when the YouTrack activity log had been completely received and processed.
   */
  youTrackTimestamp: number;

  /**
   * Mapping from contributor IDs in {@link plan} to the real name ({@link ExternalContributor.name}).
   *
   * This map only includes IDs for external contributors. IDs not in this map are YouTrack user IDs.
   */
  idToExternalContributorName: Map<string, string>;
}

/**
 * Controller for {@link App}.
 */
export class AppCtrl {
  /**
   * Signal carrying the kind of action triggered by the button in the nav bar.
   */
  public readonly action: () => Action;

  /**
   * Signal carrying the last YouTrack metadata.
   */
  public readonly youTrackMetadata: () => YouTrackMetadata | undefined;

  /**
   * Signal carrying the progress of the current action, or undefined if there is no current action.
   */
  public readonly progress: () => number | undefined;

  /**
   * Signal carrying the latest project plan and the settings used to compute it, or undefined if no project plan was
   * computed yet.
   *
   * The settings are the result of {@link toNormalizedPlainSettings}(); that is, they are normalized.
   */
  public readonly extendedProjectPlan: () => ExtendedProjectPlan | undefined;

  /**
   * The settings controller.
   */
  public readonly settingsCtrl: SettingsCtrl;

  /**
   * The alert controller for displaying alerts to the user.
   */
  public readonly alertCtrl = new AlertsCtrl();

  private readonly progress_: DataSignal<number | undefined> = S.value(undefined);
  private readonly extendedProjectPlan_: DataSignal<ExtendedProjectPlan | undefined> = S.value(undefined);
  private reconstructProjectPlanTimestamp: number | undefined;
  private reconstructProjectPlanResult: ProjectPlan | undefined;
  private readonly connectSignal_: DataSignal<null> = S.data(null);
  private readonly youTrackCtrl_: YouTrackCtrl;
  private readonly youTrackMetadata_: DataSignal<YouTrackMetadata | undefined> = S.value(undefined);

  /**
   * Constructor.
   *
   * @param app the non-transient application state
   * @param appName the name of the application
   */
  constructor(
      public readonly app: App,
      public readonly appName: string = document.title
  ) {
    this.settingsCtrl = new SettingsCtrl(this.app.settings, this.youTrackMetadata_, this.connectSignal_);
    this.youTrackCtrl_ = new YouTrackCtrl(this.youTrackMetadata_, this.settingsCtrl.verifiedBaseUrl, this.alertCtrl);

    this.action = S(() => actionFromState(
        this.progress_(), this.youTrackCtrl_.pendingMetadata(), this.youTrackMetadata_(),
        this.extendedProjectPlan_(), toNormalizedPlainSettings(this.app.settings)));
    this.youTrackMetadata = this.youTrackMetadata_;
    this.progress = this.progress_;
    this.extendedProjectPlan = this.extendedProjectPlan_;

    // 'seed' is undefined (the calculation does not keep a state), and 'onchanges' is true (skip the initial run).
    S.on(this.connectSignal_, () => this.connect(), undefined, true);

    // Bind document.title to react to changes of this.app.transient.appName
    S(() => {
      const title: string = this.app.settings.name();
      document.title = title.length > 0
          ? `${appName}: ${title}`
          : appName;
    });
  }

  private showErrorIfFailure(title: string, promise: Promise<void>): void {
    promise
        .catch((exception) => this.alertCtrl.alert(title, exception))
        .finally(() => {
          this.progress_(undefined);
        });
  }

  public defaultAction(): void {
    const action: Action = this.action();
    switch (action) {
      case Action.CONNECT: return this.connect();
      case Action.BUILD_PLAN: return this.showErrorIfFailure('Failed to build project plan', this.buildPlan());
      case Action.UPDATE_PREDICTION:
        return this.showErrorIfFailure('Failed to update prediction', this.updatePrediction());
      case Action.STOP: case Action.NOTHING: return;
      default: return unreachableCase(action);
    }
  }

  private connect(): void {
    goToOauthPage(this.settingsCtrl.verifiedBaseUrl(), this.settingsCtrl.settings.youTrackServiceId(), this.app);
  }

  private async buildPlan(currentConfig: Plain<Settings> = toNormalizedPlainSettings(this.app.settings)):
      Promise<void> {
    const typeFieldId = currentConfig.typeFieldId;
    const splittableTypeIds = new Set<string>(currentConfig.splittableTypeIds);
    const youTrackConfig: YouTrackConfig = {
      stateFieldId: currentConfig.stateFieldId,
      inactiveStateIds: currentConfig.inactiveStateIds,
      remainingEffortFieldId: currentConfig.remainingEffortFieldId,
      remainingWaitFieldId: currentConfig.remainingWaitFieldId,
      assigneeFieldId: currentConfig.assigneeFieldId,
      otherCustomFieldIds: [typeFieldId],
      dependsLinkTypeId: currentConfig.dependsLinkTypeId,
      doesInwardDependOnOutward: currentConfig.doesInwardDependOnOutward,
      savedQueryId: currentConfig.savedQueryId,
      overlaySavedQueryId: currentConfig.overlaySavedQueryId,
      minStateChangeDurationMs: MIN_STATE_CHANGE_DURATION_MS,
      defaultRemainingEffortMs: DEFAULT_REMAINING_EFFORT_MS,
      defaultWaitTimeMs: DEFAULT_WAIT_TIME_MS,
      isSplittableFn: (issue: YouTrackIssue) => {
        const value: string | undefined = issue.customFields[typeFieldId];
        return splittableTypeIds.has(value);
      },
    };
    this.reconstructProjectPlanResult = await reconstructProjectPlan(
        this.settingsCtrl.verifiedBaseUrl(), youTrackConfig, (percentDone) => this.progress_(percentDone));
    this.reconstructProjectPlanTimestamp = Date.now();
    await this.updatePrediction(currentConfig);
  }

  private async updatePrediction(currentConfig: Plain<Settings> = toNormalizedPlainSettings(this.app.settings)):
      Promise<void> {
    const youTrackMetadata: YouTrackMetadata | undefined = this.youTrackMetadata_();
    assert(this.reconstructProjectPlanResult !== undefined && youTrackMetadata !== undefined &&
        this.reconstructProjectPlanTimestamp !== undefined);

    const contributors: Contributor[] = [];
    const idToExternalContributorName = new Map<string, string>();
    for (const contributor of currentConfig.contributors) {
      let id: string;
      let numMembers: number;
      if (contributor.type === ContributorKind.EXTERNAL) {
        id = `${EXTERNAL_CONTRIBUTOR_ID_PREFIX}${idToExternalContributorName.size}`;
        idToExternalContributorName.set(id, contributor.name);
        numMembers = contributor.numMembers;
      } else {
        id = contributor.id;
        numMembers = 1;
      }
      contributors.push({
        id,
        minutesPerWeek: 60 * contributor.hoursPerWeek,
        numMembers,
      });
    }
    const schedulingOptions: SchedulingOptions = {
      contributors,
      minutesPerWeek: youTrackMetadata!.minutesPerWorkWeek,
      resolutionMs: SCHEDULING_RESOLUTION_MS,
      minActivityDuration: MIN_ACTIVITY_DURATION,
      predictionStartTimeMs: this.reconstructProjectPlanTimestamp,
    };
    const schedule: Schedule = await scheduleUnresolved(
        this.reconstructProjectPlanResult!.issues, schedulingOptions);
    const finalPlan: ProjectPlan | Failure = appendSchedule(
        this.reconstructProjectPlanResult!, schedule, schedulingOptions.predictionStartTimeMs!);
    if (isFailure(finalPlan)) {
      throw finalPlan;
    } else {
      this.extendedProjectPlan_({
        plan: finalPlan,
        settings: currentConfig,
        youTrackTimestamp: this.reconstructProjectPlanTimestamp!,
        idToExternalContributorName,
      });
    }
  }
}

function actionFromState(progress: number | undefined, pendingMetadata: boolean,
    youTrackMetadata: YouTrackMetadata | undefined, extendedProjectPlan: ExtendedProjectPlan | undefined,
    currentSettings: Plain<Settings>): Action {
  if (progress !== undefined || pendingMetadata) {
    return Action.STOP;
  } else if (youTrackMetadata === undefined) {
    return Action.CONNECT;
  } else if (extendedProjectPlan === undefined) {
    return Action.BUILD_PLAN;
  }

  const newWithoutContributors = {...currentSettings};
  const lastWithoutContributors = {...extendedProjectPlan.settings};
  delete newWithoutContributors.contributors;
  delete lastWithoutContributors.contributors;
  const youTrackConfigChanged = !deepEquals(newWithoutContributors, lastWithoutContributors);
  const contributorsChanged = !deepEquals(currentSettings.contributors, extendedProjectPlan.settings.contributors);

  if (youTrackConfigChanged) {
    return Action.BUILD_PLAN;
  } else if (contributorsChanged) {
    return Action.UPDATE_PREDICTION;
  } else {
    return Action.NOTHING;
  }
}
