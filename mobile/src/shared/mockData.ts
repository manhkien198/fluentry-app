export const lessons = [
  {
    id: "lesson-1",
    title: "Confident Introductions",
    level: "Beginner",
    duration: "8 min",
    xp: 30,
    prompt: "Hello, my name is Anna and I love learning English every day.",
  },
  {
    id: "lesson-2",
    title: "Travel Essentials",
    level: "Intermediate",
    duration: "10 min",
    xp: 45,
    prompt: "Could you tell me where the nearest train station is?",
  },
  {
    id: "lesson-3",
    title: "Work Presentation",
    level: "Advanced",
    duration: "12 min",
    xp: 60,
    prompt:
      "Our quarterly results exceeded expectations because the team executed consistently.",
  },
];

export const sampleResult = {
  sessionId: "session-demo-1",
  overallScore: 86,
  pronunciationScore: 84,
  fluencyScore: 88,
  words: [
    { text: "Hello", score: 92, status: "good" },
    { text: "my", score: 90, status: "good" },
    { text: "name", score: 78, status: "warning" },
    { text: "is", score: 91, status: "good" },
    { text: "Anna", score: 73, status: "warning" },
  ],
  tips: [
    'Open your mouth more on the vowel in "name".',
    'Stress the first syllable in "Anna" more clearly.',
    "Keep a steady rhythm through the full sentence.",
  ],
};
