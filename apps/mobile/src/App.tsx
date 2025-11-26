import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 justify-center items-center bg-white">
      <Text className="text-2xl font-bold text-black">Socio Mobile</Text>
      <Text className="text-base mt-2 text-gray-600">Location-based chat room discovery platform</Text>
    </SafeAreaView>
  );
}

export default App;
