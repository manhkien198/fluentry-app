export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Lesson: { lessonId: string };
  Practice: { lessonId: string; prompt: string };
  Result: { sessionId: string };
  Progress: undefined;
  History: undefined;
  Trends: undefined;
  ContentInfo: undefined;
  Drills: undefined;
  Settings: undefined;
};
