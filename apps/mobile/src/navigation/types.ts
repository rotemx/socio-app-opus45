import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Root stack navigation parameter list
 * Defines all screens and their params in the main navigation stack
 */
export type RootStackParamList = {
  // Main tabs
  Home: undefined;
  Discover: undefined;
  Profile: undefined;
  Settings: undefined;

  // Chat screens
  ChatRoom: { roomId: string; roomName: string };
  CreateRoom: undefined;

  // Auth screens
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  PhoneVerification: { mode: 'login' | 'register' } | undefined;
};

/**
 * Screen props type helper
 * Usage: type Props = RootStackScreenProps<'ChatRoom'>
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/**
 * Declaration for useNavigation hook typing
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
