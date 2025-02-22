import { TWorkflowById } from '@/domains/workflows/fetchers';
import { FunctionComponent } from 'react';
import { ICallToActionDocumentSelection } from '@/lib/blocks/components/DirectorsCallToAction/interfaces';

export interface ICallToActionLegacyProps {
  value: {
    text: string;
    props: {
      id: string;
      workflow: TWorkflowById;
      disabled: boolean;
      decision: 'reject' | 'approve' | 'revision' | 'revised';
      documentSelection?: ICallToActionDocumentSelection;
      contextUpdateMethod?: 'base' | 'director';
      revisionReasons?: string[];
      rejectionReasons?: string[];
      onReuploadReset?: () => void;
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
      onDialogClose?: () => void;
      dialog: {
        reupload: {
          Description: FunctionComponent;
        };
      };
    };
  };
}
