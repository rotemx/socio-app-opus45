import { create } from 'zustand';
import type { ChatRoom, RoomWithDistance, RoomMember } from '@socio/types';

interface RoomState {
  currentRoom: ChatRoom | null;
  nearbyRooms: RoomWithDistance[];
  myRooms: ChatRoom[];
  members: Record<string, RoomMember[]>;
  setCurrentRoom: (room: ChatRoom | null) => void;
  setNearbyRooms: (rooms: RoomWithDistance[]) => void;
  setMyRooms: (rooms: ChatRoom[]) => void;
  setMembers: (roomId: string, members: RoomMember[]) => void;
  addMember: (roomId: string, member: RoomMember) => void;
  removeMember: (roomId: string, userId: string) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  nearbyRooms: [],
  myRooms: [],
  members: {},

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setNearbyRooms: (rooms) => set({ nearbyRooms: rooms }),
  setMyRooms: (rooms) => set({ myRooms: rooms }),

  setMembers: (roomId, members) =>
    set((state) => ({
      members: {
        ...state.members,
        [roomId]: members,
      },
    })),

  addMember: (roomId, member) =>
    set((state) => ({
      members: {
        ...state.members,
        [roomId]: [...(state.members[roomId] || []), member],
      },
    })),

  removeMember: (roomId, userId) =>
    set((state) => ({
      members: {
        ...state.members,
        [roomId]: (state.members[roomId] || []).filter((m) => m.userId !== userId),
      },
    })),
}));
