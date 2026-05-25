# Product scope

## Vision
Fluentry aims to deliver a mobile learning experience focused on English pronunciation, lesson progression, and personalized speaking feedback while intentionally mimicking ELSA's coaching style.

## Target user
- English learners who want structured speaking practice
- Users preparing for school, work, travel, or interviews
- Learners who need immediate and actionable pronunciation coaching

## MVP scope
### Included
- Guest entry or simple sign-in flow
- Home dashboard with streak and recommended lessons
- Lesson detail screen
- Guided speaking practice for fixed prompts
- Audio upload to backend
- Result screen with:
  - overall score
  - pronunciation score
  - fluency score
  - per-word feedback
  - coaching tips
- Progress screen with streak, XP, weak sounds, and improvement trends

### Not in first release
- Open-ended conversation practice
- Social features
- Teacher dashboard
- Full subscription billing
- Real-time streaming feedback during speech
- Native-level enterprise speech analytics

## Elsa-mimic characteristics to preserve in Fluentry
- Polished onboarding and home dashboard
- Lesson-driven progression
- Strong visual score presentation
- Per-word pronunciation feedback
- Habit-building loop: streak, goals, XP, retry flow

## Backend scoring strategy
### Phase 1
- Fixed prompt reading
- Mock or rule-based scoring
- API contract stable for mobile integration

### Phase 2
- Forced alignment against expected text
- CMUdict + g2p-en phoneme mapping
- Duration, energy, and rhythm-based heuristics
- Vietnamese learner error patterns

### Phase 3
- Improved phoneme-level scoring
- Stress and rhythm analysis
- Personalized weak-sound tracking
- Better feedback ranking

## Success criteria for MVP
- App runs on Android and iOS via Expo workflow
- Backend returns stable scoring payloads
- User can complete a lesson from start to result
- Result screen is useful enough to guide the next practice attempt
