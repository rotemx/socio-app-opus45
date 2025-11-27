import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Message, CursorPaginatedResponse } from '@socio/types';

export function useChatHistory(roomId: string) {
  return useInfiniteQuery<
    CursorPaginatedResponse<Message>,
    Error,
    CursorPaginatedResponse<Message>,
    string[],
    string | undefined
  >({
    queryKey: ['messages', roomId],
    queryFn: async ({ pageParam }) => {
      const response = await api.get<CursorPaginatedResponse<Message>>(
        `/rooms/${roomId}/messages`,
        {
          params: {
            cursor: pageParam,
            limit: 50,
          },
        }
      );
      return response;
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    initialPageParam: undefined,
    enabled: !!roomId,
  });
}
