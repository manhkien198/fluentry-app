import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootStackParamList } from './src/navigation/types';

import { AuthScreen } from './src/features/auth/AuthScreen';
import { HomeScreen } from './src/features/home/HomeScreen';
import { ContentInfoScreen } from './src/features/home/ContentInfoScreen';
import { LessonScreen } from './src/features/lesson/LessonScreen';
import { DrillsScreen } from './src/features/lesson/DrillsScreen';
import { PracticeScreen } from './src/features/practice/PracticeScreen';
import { ResultScreen } from './src/features/result/ResultScreen';
import { ProgressScreen } from './src/features/progress/ProgressScreen';
import { HistoryScreen } from './src/features/progress/HistoryScreen';
import { TrendsScreen } from './src/features/progress/TrendsScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer theme={DarkTheme}>
            <Stack.Navigator
              id=RootStack
              initialRouteName=Auth
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name=Auth component={AuthScreen} />
              <Stack.Screen name=Home component={HomeScreen} />
              <Stack.Screen name=Content component={ContentInfoScreen} />
              <Stack.Screen name=Lesson component={LessonScreen} />
              <Stack.Screen name=Drills component={DrillsScreen} />
              <Stack.Screen name=Practice component={PracticeScreen} />
              <Stack.Screen name=Result component={ResultScreen} />
              <Stack.Screen name=Progress component={ProgressScreen} />
              <Stack.Screen name=History component={HistoryScreen} />
              <Stack.Screen name=Trends component={TrendsScreen} />
              <Stack.Screen name=Settings component={SettingsScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

