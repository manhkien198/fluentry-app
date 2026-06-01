describe("shared/haptics", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.unmock("react-native");
    jest.unmock("expo-haptics");
  });

  it("triggers impact on android success/error", async () => {
    const impactAsync = jest.fn(async () => undefined);
    const notificationAsync = jest.fn(async () => undefined);

    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-haptics", () => ({
      impactAsync,
      notificationAsync,
      ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
      NotificationFeedbackType: { Success: "Success", Error: "Error" },
    }));

    let haptic: any;
    let useAppStore: any;
    jest.isolateModules(() => {
      ({ useAppStore } = require("../src/shared/store"));
      ({ haptic } = require("../src/shared/haptics"));
    });

    useAppStore.getState().setHapticsEnabled(true);
    await haptic("success");
    await haptic("error");

    expect(impactAsync).toHaveBeenCalled();
    expect(notificationAsync).not.toHaveBeenCalled();
  });

  it("uses notification on ios success/error and impact on medium/default", async () => {
    const impactAsync = jest.fn(async () => undefined);
    const notificationAsync = jest.fn(async () => undefined);

    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));
    jest.doMock("expo-haptics", () => ({
      impactAsync,
      notificationAsync,
      ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
      NotificationFeedbackType: { Success: "Success", Error: "Error" },
    }));

    let haptic: any;
    let useAppStore: any;
    jest.isolateModules(() => {
      ({ useAppStore } = require("../src/shared/store"));
      ({ haptic } = require("../src/shared/haptics"));
    });

    useAppStore.getState().setHapticsEnabled(true);
    await haptic("success");
    await haptic("error");
    await haptic("medium");
    await haptic("light");

    expect(notificationAsync).toHaveBeenCalledTimes(2);
    expect(impactAsync).toHaveBeenCalledTimes(2);
  });

  it("returns early when haptics disabled", async () => {
    const impactAsync = jest.fn(async () => undefined);

    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));
    jest.doMock("expo-haptics", () => ({
      impactAsync,
      notificationAsync: jest.fn(async () => undefined),
      ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
      NotificationFeedbackType: { Success: "Success", Error: "Error" },
    }));

    let haptic: any;
    let useAppStore: any;
    jest.isolateModules(() => {
      ({ useAppStore } = require("../src/shared/store"));
      ({ haptic } = require("../src/shared/haptics"));
    });

    useAppStore.getState().setHapticsEnabled(false);
    await haptic("success");

    expect(impactAsync).not.toHaveBeenCalled();
  });

  it("swallows module errors", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));
    jest.doMock("expo-haptics", () => {
      throw new Error("missing");
    });

    let haptic: any;
    let useAppStore: any;
    jest.isolateModules(() => {
      ({ useAppStore } = require("../src/shared/store"));
      ({ haptic } = require("../src/shared/haptics"));
    });

    useAppStore.getState().setHapticsEnabled(true);
    await expect(haptic("light")).resolves.toBeUndefined();
  });

  it("does nothing when expo-haptics missing", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));
    jest.doMock("expo-haptics", () => null);

    let haptic: any;
    jest.isolateModules(() => {
      ({ haptic } = require("../src/shared/haptics"));
    });

    await expect(haptic("light")).resolves.toBeUndefined();
  });
});
