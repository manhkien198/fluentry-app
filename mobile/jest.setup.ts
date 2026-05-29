import "@testing-library/jest-native/extend-expect";

jest.mock("expo-av", () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(async () => undefined),
      startAsync: jest.fn(async () => undefined),
      stopAndUnloadAsync: jest.fn(async () => undefined),
      getURI: jest.fn(() => "file://mock-recording.m4a"),
    })),
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  },
}));
