import "@testing-library/jest-native/extend-expect";

const originalConsoleError = console.error;

beforeAll(() => {
  console.error = (...args: any[]) => {
    const joined = args
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .join(" ");

    if (
      joined.includes("was not wrapped in act(...)") &&
      (joined.includes("AuthScreen") || joined.includes("VirtualizedList"))
    ) {
      return;
    }

    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Lightweight React Native Paper mocks for unit tests.
jest.mock("react-native-paper", () => {
  const React = require("react");
  const {
    Text: RNText,
    View,
    Pressable,
    TextInput: RNTextInput,
    ActivityIndicator: RNActivityIndicator,
  } = require("react-native");

  const Text = ({ children, ...props }: any) => (
    <RNText {...props}>{children}</RNText>
  );

  const Button = ({ children, onPress }: any) => (
    <Pressable onPress={onPress} accessibilityRole="button">
      <RNText>{children}</RNText>
    </Pressable>
  );

  const Card = ({ children }: any) => <View>{children}</View>;
  Card.Content = ({ children }: any) => <View>{children}</View>;

  const SegmentedButtons = ({ buttons = [], onValueChange }: any) => (
    <View>
      {buttons.map((b: any) => (
        <Pressable key={b.value} onPress={() => onValueChange?.(b.value)}>
          <RNText>{b.label}</RNText>
        </Pressable>
      ))}
    </View>
  );

  const Switch = ({ value, onValueChange }: any) => (
    <Pressable onPress={() => onValueChange?.(!value)}>
      <RNText>{value ? "ON" : "OFF"}</RNText>
    </Pressable>
  );

  const TextInput = ({ value, onChangeText, ...props }: any) => (
    <RNTextInput value={value} onChangeText={onChangeText} {...props} />
  );

  const ProgressBar = ({ progress }: any) => <RNText>{String(progress)}</RNText>;
  const Snackbar = ({ children }: any) => <View>{children}</View>;
  const ActivityIndicator = (props: any) => <RNActivityIndicator {...props} />;

  return {
    Text,
    Button,
    Card,
    SegmentedButtons,
    Switch,
    TextInput,
    ProgressBar,
    Snackbar,
    ActivityIndicator,
  };
});

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock("expo-audio", () => ({
  AudioModule: {
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  setAudioModeAsync: jest.fn(async () => undefined),
  RecordingPresets: {
    HIGH_QUALITY: {},
  },
  useAudioRecorder: jest.fn(() => ({
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    uri: "file://mock-recording.m4a",
  })),
}));
