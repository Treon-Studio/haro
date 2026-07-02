<purpose>
This file defines the strict architectural rules for the mobile application (`apps/app`), which uses Expo 54, React Native 0.81, and Expo Router 6.
</purpose>

<react_native_architecture_rules>
- **New Architecture**: The app uses the New Architecture (Fabric/TurboModules). Do not use old bridge-based patterns.
- **Expo Router**: Do NOT use `react-navigation` stack navigators directly. Use Expo Router's file-based routing (`app/` directory).
- **Native Directories**: Do NOT manually edit files in the `ios/` or `android/` directories. All native configuration must be done via Expo Config Plugins in `app.config.ts`.
- **UI Components**: Use HeroUI Native and Uniwind for styling, avoiding raw StyleSheet APIs unless absolutely necessary for performance.
- **Type-Safe Routing**: Always use typed routes provided by Expo Router to prevent broken navigation.
- **Lists**: Use `FlashList` from `@shopify/flash-list` instead of standard `FlatList` for rendering long lists to ensure 60fps performance.
</react_native_architecture_rules>

<state_and_data_rules>
- **Local State**: Use Zustand (`packages/stores`) for client-side state.
- **Server Data**: Use React Query (`packages/api-hooks`) for all server interactions. Do not use raw `fetch` or `axios` inside components.
</state_and_data_rules>
