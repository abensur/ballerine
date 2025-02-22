import { useMemo } from 'react';
import { createBlocksTyped } from '@/lib/blocks/create-blocks-typed/create-blocks-typed';

export const useBankingDetailsBlock = ({ bankDetails, workflow }) => {
  return useMemo(() => {
    if (Object.keys(bankDetails ?? {}).length === 0) {
      return [];
    }

    return createBlocksTyped()
      .addBlock()
      .addCell({
        type: 'block',
        value: createBlocksTyped()
          .addBlock()
          .addCell({
            type: 'heading',
            value: 'Banking details',
          })
          .addCell({
            type: 'subheading',
            value: 'User-provided Data',
          })
          .addCell({
            type: 'details',
            value: {
              data: Object.entries(bankDetails)?.map(([title, value]) => ({
                title,
                value,
                isEditable: false,
              })),
            },
            workflowId: workflow?.id,
            documents: workflow?.context?.documents,
            hideSeparator: true,
          })
          .build()
          .flat(1),
      })
      .build();
  }, [bankDetails, workflow]);
};
