import { DefaultContextSchema, getDocumentsByCountry, StateTag } from '@ballerine/common';
import { AnyObject, ctw } from '@ballerine/ui';
import { UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toTitleCase } from 'string-ts';
import {
  composePickableCategoryType,
  extractCountryCodeFromWorkflow,
} from '@/pages/Entity/hooks/useEntityLogic/utils';
import { motionBadgeProps } from '../../motion-badge-props';
import { useApproveTaskByIdMutation } from '@/domains/entities/hooks/mutations/useApproveTaskByIdMutation/useApproveTaskByIdMutation';
import { useRemoveDecisionTaskByIdMutation } from '@/domains/entities/hooks/mutations/useRemoveDecisionTaskByIdMutation/useRemoveDecisionTaskByIdMutation';
import { getPostRemoveDecisionEventName } from '@/pages/Entity/get-post-remove-decision-event-name';
import { useCaseState } from '@/pages/Entity/components/Case/hooks/useCaseState/useCaseState';
import { useAuthenticatedUserQuery } from '@/domains/auth/hooks/queries/useAuthenticatedUserQuery/useAuthenticatedUserQuery';
import { selectDirectorsDocuments } from '@/pages/Entity/selectors/selectDirectorsDocuments';
import { TWorkflowById } from '@/domains/workflows/fetchers';
import { useCaseDecision } from '@/pages/Entity/components/Case/hooks/useCaseDecision/useCaseDecision';
import { getPostDecisionEventName } from '../../components/CallToActionLegacy/hooks/useCallToActionLegacyLogic/useCallToActionLegacyLogic';
import { valueOrNA } from '@/common/utils/value-or-na/value-or-na';
import { createBlocksTyped } from '@/lib/blocks/create-blocks-typed/create-blocks-typed';

export type Director = AnyObject;

export const useDirectorsBlocks = ({
  workflow,
  documentFiles,
  documentImages,
  onReuploadNeeded,
  isLoadingReuploadNeeded,
}: {
  workflow: TWorkflowById;
  documentFiles: UseQueryResult[];
  documentImages: Array<Array<string>>;
  onReuploadNeeded: ({
    workflowId,
    documentId,
    reason,
  }: {
    workflowId: string;
    documentId: string;
    reason?: string;
  }) => () => void;
  isLoadingReuploadNeeded: boolean;
}) => {
  const { mutate } = useRemoveDecisionTaskByIdMutation(
    workflow?.id,
    getPostRemoveDecisionEventName(workflow),
  );

  const { data: session } = useAuthenticatedUserQuery();
  const caseState = useCaseState(session?.user, workflow);
  const { noAction } = useCaseDecision();

  const directors = useMemo(
    () => (workflow?.context?.entity?.data?.additionalInfo?.directors as Director[]) || [],
    [workflow],
  );
  const documents = useMemo(() => selectDirectorsDocuments(workflow), [workflow]);

  const documentSchemas = useMemo(() => {
    const issuerCountryCode = extractCountryCodeFromWorkflow(workflow);
    const documentsSchemas = issuerCountryCode ? getDocumentsByCountry(issuerCountryCode) : [];

    if (!Array.isArray(documentsSchemas) || !documentsSchemas.length) {
      console.warn(`No document schema found for issuer country code of "${issuerCountryCode}".`);
    }

    return documentsSchemas;
  }, [workflow]);

  const handleRevisionDecisionsReset = useCallback(() => {
    const documentsToReset = documents.filter(document => document.decision?.status);

    documentsToReset.forEach(document => {
      mutate({ documentId: document.id, contextUpdateMethod: 'director' });
    });
  }, [documents, mutate]);

  const postApproveEventName = getPostDecisionEventName(workflow);
  const { mutate: mutateApproveTaskById, isLoading: isLoadingApproveTaskById } =
    useApproveTaskByIdMutation(workflow?.id, postApproveEventName);
  const onMutateApproveTaskById = useCallback(
    ({
        taskId,
        contextUpdateMethod,
      }: {
        taskId: string;
        contextUpdateMethod: 'base' | 'director';
      }) =>
      () =>
        mutateApproveTaskById({ documentId: taskId, contextUpdateMethod }),
    [mutateApproveTaskById],
  );

  const blocks = useMemo(() => {
    return directors
      .filter(director => Array.isArray(director.additionalInfo?.documents))
      .flatMap(director => {
        const { documents } = director.additionalInfo;
        const isDocumentRevision = documents.some(
          document => document?.decision?.status === 'revision',
        );
        const multiDocumentsBlocks = documents.flatMap((document, docIndex) => {
          const isDoneWithRevision = document?.decision?.status === 'revised';
          const additionalProperties = composePickableCategoryType(
            document.category,
            document.type,
            documentSchemas,
          );

          const decisionCell = createBlocksTyped()
            .addBlock()
            .addCell({
              type: 'details',
              value: {
                id: document.id,
                title: 'Decision',
                hideSeparator: true,
                data: document?.decision?.status
                  ? Object.entries(document?.decision ?? {}).map(([title, value]) => ({
                      title,
                      value,
                    }))
                  : [],
              },
              workflowId: workflow?.id,
              documents,
            })
            .cellAt(0, 0);

          const getDecisionStatusOrAction = (
            decisionStatus: NonNullable<
              DefaultContextSchema['documents'][number]['decision']
            >['status'],
          ) => {
            if (decisionStatus === 'approved') {
              return createBlocksTyped()
                .addBlock()
                .addCell({
                  type: 'badge',
                  value: 'Approved',
                  props: {
                    ...motionBadgeProps,
                    variant: 'success',
                    className: `text-sm font-bold bg-success/20`,
                  },
                })
                .build()
                .flat(1);
            }

            return createBlocksTyped()
              .addBlock()
              .addCell({
                type: 'callToAction',
                value: {
                  text: 'Approve',
                  onClick: onMutateApproveTaskById({
                    taskId: document.id,
                    contextUpdateMethod: 'director',
                  }),
                  props: {
                    disabled:
                      (!isDoneWithRevision && Boolean(document?.decision?.status)) ||
                      noAction ||
                      isLoadingApproveTaskById ||
                      !caseState.actionButtonsEnabled,
                    size: 'wide',
                    variant: 'success',
                  },
                },
              })
              .build()
              .flat(1);
          };

          return createBlocksTyped()
            .addBlock()
            .addCell({
              type: 'container',
              value: createBlocksTyped()
                .addBlock()
                .addCell({
                  id: 'actions',
                  type: 'container',
                  props: {
                    className: 'mt-0',
                  },
                  value: getDecisionStatusOrAction(document?.decision?.status),
                })
                .addCell({
                  id: 'header',
                  type: 'container',
                  value: createBlocksTyped()
                    .addBlock()
                    .addCell({
                      type: 'container',
                      value: createBlocksTyped()
                        .addBlock()
                        .addCell({
                          type: 'subheading',
                          value: `${valueOrNA(toTitleCase(document.category ?? ''))} - ${valueOrNA(
                            toTitleCase(document.type ?? ''),
                          )}`,
                        })
                        .addCell({
                          type: 'details',
                          value: {
                            id: document.id,
                            data: Object.entries(
                              {
                                ...additionalProperties,
                                ...document.propertiesSchema?.properties,
                              } ?? {},
                            )?.map(
                              ([
                                title,
                                {
                                  type,
                                  format,
                                  pattern,
                                  dropdownOptions,
                                  value,
                                  formatMinimum,
                                  formatMaximum,
                                },
                              ]) => {
                                const fieldValue = value || (document.properties?.[title] ?? '');
                                const isDoneWithRevision = document?.decision?.status === 'revised';
                                const isEditable =
                                  isDoneWithRevision || !document?.decision?.status;

                                return {
                                  title,
                                  value: fieldValue,
                                  type,
                                  format,
                                  pattern,
                                  dropdownOptions,
                                  isEditable: isEditable && caseState.writeEnabled,
                                  minimum: formatMinimum,
                                  maximum: formatMaximum,
                                };
                              },
                            ),
                          },
                          documents,
                          workflowId: workflow?.id,
                        })
                        .addCell(decisionCell)
                        .build()
                        .flat(1),
                    })
                    .addCell({
                      type: 'container',
                      value: createBlocksTyped()
                        .addBlock()
                        .addCell({
                          type: 'multiDocuments',
                          isLoading: documentFiles?.some(({ isLoading }) => isLoading),
                          value: {
                            data:
                              document?.pages?.map(({ type, metadata }, pageIndex) => ({
                                title: `${valueOrNA(
                                  toTitleCase(document.category ?? ''),
                                )} - ${valueOrNA(toTitleCase(document.type ?? ''))}${
                                  metadata?.side ? ` - ${metadata?.side}` : ''
                                }`,
                                imageUrl: documentImages?.[docIndex]?.[pageIndex],
                                fileType: type,
                              })) ?? [],
                          },
                        })
                        .build()
                        .flat(1),
                    })
                    .build()
                    .flat(1),
                })
                .build()
                .flat(1),
            })
            .build()
            .flat(1);
        });
        const getReuploadActionOrBadge = (tags: Array<string>) => {
          if (tags?.includes(StateTag.REVISION)) {
            return createBlocksTyped()
              .addBlock()
              .addCell({
                type: 'badge',
                value: 'Pending re-upload',
                props: {
                  ...motionBadgeProps,
                  variant: 'warning',
                  className: 'text-sm font-bold',
                },
              })
              .build()
              .flat(1);
          }

          return createBlocksTyped()
            .addBlock()
            .addCell({
              type: 'directorsCallToAction',
              value: {
                text: 'Re-upload needed',
                props: {
                  documents,
                  workflow,
                  onReset: handleRevisionDecisionsReset,
                  onReuploadNeeded,
                  isLoadingReuploadNeeded,
                  disabled: noAction || !caseState.actionButtonsEnabled,
                },
              },
            })
            .build()
            .flat(1);
        };

        return createBlocksTyped()
          .addBlock()
          .addCell({
            type: 'block',
            value: createBlocksTyped()
              .addBlock()
              .addCell({
                type: 'container',
                value: createBlocksTyped()
                  .addBlock()
                  .addCell({
                    type: 'heading',
                    value: `Director - ${director.firstName} ${director.lastName}`,
                  })
                  .addCell({
                    id: 'actions',
                    type: 'container',
                    value: getReuploadActionOrBadge(workflow?.tags ?? []),
                  })
                  .build()
                  .flat(1),
              })
              .build()
              .concat(multiDocumentsBlocks)
              .flat(1),
            className: ctw({
              'shadow-[0_4px_4px_0_rgba(174,174,174,0.0625)] border-[1px] border-warning':
                isDocumentRevision,
              'bg-warning/10': isDocumentRevision && !workflow?.tags?.includes(StateTag.REVISION),
            }),
          })
          .build();
      });
  }, [
    directors,
    workflow,
    documentSchemas,
    documentFiles,
    onMutateApproveTaskById,
    noAction,
    isLoadingApproveTaskById,
    caseState.actionButtonsEnabled,
    caseState.writeEnabled,
    documentImages,
    handleRevisionDecisionsReset,
  ]);

  return blocks;
};
