import { ActionHandler } from '@/components/organisms/DynamicUI/StateManager/components/ActionsHandler/action-handlers/action-handler.abstract';
import { ActionHandlerManager } from '@/components/organisms/DynamicUI/StateManager/components/ActionsHandler/hooks/useActionsHandlerLogic/hooks/helpers/action-handler-manager';
import { StateMachineAPI } from '@/components/organisms/DynamicUI/StateManager/hooks/useMachineLogic';
import { useDynamicUIContext } from '@/components/organisms/DynamicUI/hooks/useDynamicUIContext';
import { UIElementsState } from '@/components/organisms/DynamicUI/hooks/useUIStateLogic/hooks/useUIElementsStateLogic/types';
import { Action } from '@/domains/collection-flow';
import { useRefValue } from '@/hooks/useRefValue';
import PQueue from 'p-queue';
import { useCallback, useMemo } from 'react';

const queue = new PQueue({ concurrency: 1 });

export const useActionsProcessingLogic = (
  api: StateMachineAPI,
  actionsHandlers: ActionHandler[],
) => {
  const { state, helpers } = useDynamicUIContext();
  const { overrideState } = helpers;
  const uiStateRef = useRefValue(state);
  const apiRef = useRefValue(api);
  const actionsManager = useMemo(
    () => new ActionHandlerManager(actionsHandlers),
    [actionsHandlers],
  );

  const toggleElementsLockState = useCallback(
    (elementNames: string[], locked: boolean) => {
      const uiState = uiStateRef.current;
      const { elements } = uiState;

      overrideState({
        ...uiState,
        elements: {
          ...elements,
          ...elementNames.reduce((elementsState, elementName) => {
            elementsState[elementName] = {
              ...elements[elementName],
              isDisabled: locked,
            };

            return elementsState;
          }, {} as UIElementsState),
        },
      });
    },
    [overrideState, uiStateRef],
  );

  const pushAction = useCallback(
    (action: Action) => {
      const actionHandler = actionsManager.getActionHandler(action.type);
      const relevantElementNames = action.dispatchOn.uiEvents.map(event => event.uiElementName);

      const actionRunner = async () => {
        const context = apiRef.current.getContext();

        if (action.params?.debounce) {
          toggleElementsLockState(relevantElementNames, true);

          const updatedContext = await actionHandler?.run(context, action, apiRef.current);
          apiRef.current.setContext(
            // @ts-ignore
            updatedContext,
          );

          toggleElementsLockState(relevantElementNames, false);
        } else {
          await actionHandler?.run(context, action, apiRef.current);
        }
      };

      void queue.add(actionRunner);
    },
    [actionsManager, apiRef, toggleElementsLockState],
  );

  return {
    pushAction,
  };
};
