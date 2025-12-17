/**
 * Interest categories for room recommendations
 * Used in onboarding flow to personalize user experience
 */

export interface Interest {
  id: string;
  label: string;
  icon: string;
}

export interface InterestCategory {
  id: string;
  name: string;
  interests: Interest[];
}

/**
 * Available interests organized by category
 * These will be used to match users with relevant rooms
 */
export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    id: 'social',
    name: 'Social & Community',
    interests: [
      { id: 'meetups', label: 'Meetups', icon: '🤝' },
      { id: 'dating', label: 'Dating', icon: '💕' },
      { id: 'friendship', label: 'Friendship', icon: '👋' },
      { id: 'networking', label: 'Networking', icon: '🔗' },
    ],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    interests: [
      { id: 'nightlife', label: 'Nightlife', icon: '🌙' },
      { id: 'fitness', label: 'Fitness', icon: '💪' },
      { id: 'food', label: 'Food & Dining', icon: '🍽️' },
      { id: 'travel', label: 'Travel', icon: '✈️' },
      { id: 'fashion', label: 'Fashion', icon: '👗' },
    ],
  },
  {
    id: 'culture',
    name: 'Arts & Culture',
    interests: [
      { id: 'music', label: 'Music', icon: '🎵' },
      { id: 'art', label: 'Art', icon: '🎨' },
      { id: 'film', label: 'Film & TV', icon: '🎬' },
      { id: 'theater', label: 'Theater', icon: '🎭' },
      { id: 'books', label: 'Books', icon: '📚' },
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    interests: [
      { id: 'sports', label: 'Sports', icon: '⚽' },
      { id: 'gaming', label: 'Gaming', icon: '🎮' },
      { id: 'outdoor', label: 'Outdoors', icon: '🏕️' },
      { id: 'yoga', label: 'Yoga & Wellness', icon: '🧘' },
      { id: 'dance', label: 'Dance', icon: '💃' },
    ],
  },
  {
    id: 'support',
    name: 'Support & Resources',
    interests: [
      { id: 'health', label: 'Health', icon: '❤️' },
      { id: 'advocacy', label: 'Advocacy', icon: '📢' },
      { id: 'education', label: 'Education', icon: '🎓' },
      { id: 'career', label: 'Career', icon: '💼' },
    ],
  },
];

/**
 * Flatten all interests for easy lookup
 */
export const ALL_INTERESTS: Interest[] = INTEREST_CATEGORIES.flatMap(
  category => category.interests,
);

/**
 * Minimum number of interests required to proceed
 */
export const MIN_INTERESTS_REQUIRED = 3;
