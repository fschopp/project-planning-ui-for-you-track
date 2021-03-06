import { mapSample, SDataArray } from 's-array';
import * as Surplus from 'surplus'; // lgtm [js/unused-local-variable]
import { Counter } from '../../utils/counter';
import { bindNumber, bindString, focusOnChangeToValue, sortableBindSarray, withClassIff } from '../../utils/surplus';
import { User } from '../../youtrack-rest';
import {
  DRAGGABLE_HANDLE_CLASS,
  EDIT_AREA_CLASS,
  FORM_GROUP_CLASS,
  HELP_CLASS,
  INPUT_CLASS,
  INPUT_CLASS_RIGHT,
  LABEL_CLASS,
  SELECT_CLASS,
} from '../bootstrap';
import { Contributor, ContributorKind } from '../contributor/contributor-model';
import {
  ContributorView,
  INPUT_WIDTH_3_DIGITS,
  MAX_HOURS_PER_WEEK,
  MAX_PERSONS_PER_CONTRIBUTORS,
} from '../contributor/contributor-view';
import { ContributorsCtrl } from './contributors-ctrl';
import { ContributorEditArea, EXTERNAL_CONTRIBUTOR_VALUE } from './contributors-model';

export interface ContributorsProperties {
  readonly label: string;
  readonly contributors: SDataArray<Contributor>;
  readonly contributorEditArea: ContributorEditArea;
  readonly ctrl: ContributorsCtrl;
  readonly youTrackUserMap: () => Map<string, User>;
  readonly invalidCounter: Counter;
}

export function ContributorsView({label, contributors, contributorEditArea, ctrl, youTrackUserMap, invalidCounter}:
    ContributorsProperties): HTMLElement {
  return (
      <div class={FORM_GROUP_CLASS}>
        <label class={LABEL_CLASS}>{label}</label>
        <div className={EDIT_AREA_CLASS}>
          <Placeholder fn={withClassIff(() => contributors().length > 0, 'd-none')} />
          <ul class="list-group mb-3"
              fn1={sortableBindSarray(contributors, {handle: `.${DRAGGABLE_HANDLE_CLASS}`})}
              fn2={withClassIff(() => contributors().length === 0, 'd-none')}>
            {mapSample(ctrl.contributorCtrls, ([contributor, contributorCtrl]) =>
                <ContributorView contributor={contributor} ctrl={contributorCtrl} youTrackUserMap={youTrackUserMap}
                                 invalidCounter={invalidCounter} />
            )}
          </ul>
          <div class="list-group-add d-flex">
            <div class="form-inline flex-grow-1">
              <div class="flex-fill mr-3 mb-1 mb-sm-0"
                   fn={withClassIff(() => ctrl.newEntryType() === ContributorKind.EXTERNAL, 'd-none')}>
                <select class={`${SELECT_CLASS} w-100`} fn={bindString(contributorEditArea.id)}>
                  {contributorEditArea.id().length === 0 &&
                    <option value="" selected disabled>Choose to add</option>
                  }
                  <option value={EXTERNAL_CONTRIBUTOR_VALUE}>External contributor…</option>
                  <optgroup label="YouTrack Users">
                    {Array.from(youTrackUserMap().values(), (user) =>
                        <option value={user.id}>{user.fullName}</option>
                    )}
                  </optgroup>
                </select>
              </div>
              <div class="input-group input-group-sm flex-nowrap flex-fill mr-3 mb-1 mb-sm-0"
                   fn={withClassIff(() => ctrl.newEntryType() !== ContributorKind.EXTERNAL, 'd-none')}>
                <input class={INPUT_CLASS} size={10} required aria-label="Name of external contributor"
                       fn1={bindString(contributorEditArea.name)}
                       fn2={focusOnChangeToValue<ContributorKind>(ctrl.newEntryType, ContributorKind.EXTERNAL)} />
                <div class="input-group-append">
                  <button type="button" class="btn btn-outline-secondary" onClick={() => ctrl.reset()}>Reset</button>
                </div>
              </div>
              <div class="input-group input-group-sm flex-nowrap mr-3 mb-1 mb-sm-0"
                   fn={withClassIff(() => ctrl.newEntryType() !== ContributorKind.EXTERNAL, 'd-none')}>
                <input type="number" class={INPUT_CLASS_RIGHT} min="1" max={MAX_PERSONS_PER_CONTRIBUTORS} required
                       style={{width: INPUT_WIDTH_3_DIGITS}}
                       aria-label="Number of persons" fn={bindNumber(contributorEditArea.numMembers)} />
                <div class="input-group-append">
                  <span class="input-group-text">👤</span>
                </div>
              </div>
              <div class="input-group input-group-sm flex-nowrap mr-3 mb-1 mb-sm-0">
                <input type="number" class={INPUT_CLASS_RIGHT} min="1" max={MAX_HOURS_PER_WEEK} required
                       style={{width: INPUT_WIDTH_3_DIGITS}}
                       aria-label="Hours per week per person" fn={bindNumber(contributorEditArea.hoursPerWeek)} />
                <div class="input-group-append">
                  <span class="input-group-text">h/week</span>
                </div>
              </div>
            </div>
            <button type="button" class="close" aria-label="Add contributor" onClick={() => ctrl.create()}>
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <small class={HELP_CLASS}>
            Define one or more contributors who can be assigned work. A contributor is either a single YouTrack user or
            an “external contributor” which can be a group of multiple people. After entering the details for a new
            contributor, click the “+” button.
          </small>
        </div>
      </div>
  );
}

function Placeholder(): HTMLElement {
  return (
      <div class="form-control form-control-sm is-invalid mb-3">
        <label class="col-form-label col-form-label-sm list-placeholder">None added</label>
      </div>
  );
}
