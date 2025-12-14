import type { User } from '@socio/types';
import { api } from './api';

export interface UpdateProfileRequest {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface UsernameAvailabilityResponse {
  available: boolean;
  suggestions?: string[];
}

export const profileService = {
  /**
   * Check if a username is available
   */
  async checkUsernameAvailability(username: string): Promise<UsernameAvailabilityResponse> {
    return api.get<UsernameAvailabilityResponse>('/users/check-username', {
      params: { username },
    });
  },

  /**
   * Update the current user's profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return api.put<User>('/users/me', data);
  },

  /**
   * Upload an avatar image and return the URL
   * In a real app, this would use presigned URLs to upload to S3
   */
  async uploadAvatar(imageUri: string): Promise<{ avatarUrl: string }> {
    // For now, this is a placeholder that would be replaced with actual upload logic
    // The backend would return a presigned URL, then the client uploads directly to S3
    return api.post<{ avatarUrl: string }>('/users/me/avatar', { imageUri });
  },
};
