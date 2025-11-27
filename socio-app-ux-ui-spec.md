# UX/UI Design System for Location-Based Social Chat Rooms

A location-based social chat application combining proximity discovery with rich messaging requires a sophisticated design system that balances discoverability, privacy, and intuitive communication patterns. This specification provides actionable guidelines for creating a **Telegram-like minimal aesthetic** built on **Material Design 3** principles, optimized for location-based social discovery.

## Core design philosophy and visual direction

The application merges four distinct paradigms: Telegram's clean messaging efficiency, Grindr's proximity-based grid discovery, WhatsApp's group communication, and Nextdoor's community-focused organization. The visual direction prioritizes **progressive disclosure**—showing essential information immediately while hiding complexity behind deliberate interactions—achieving the "simple yet powerful" goal.

**Primary design principles** guide all decisions: speed-first interfaces that feel instant, minimal chrome that lets content dominate, contextual controls that appear when needed, and consistent patterns that reduce cognitive load. Material Design 3's dynamic theming allows brand expression while maintaining platform consistency.

---

## Material Design 3 foundation specifications

### Color system with dynamic theming

M3's color architecture uses **tonal palettes** derived from key colors, enabling both consistent branding and user personalization through Material You. The system defines semantic color roles rather than fixed values:

| Role              | Light Theme         | Dark Theme | Application                            |
| ----------------- | ------------------- | ---------- | -------------------------------------- |
| Primary           | Brand color tone 40 | Tone 80    | Key buttons, active states, FAB        |
| On-Primary        | #FFFFFF             | Tone 20    | Text/icons on primary surfaces         |
| Primary-Container | Tone 90             | Tone 30    | Chat bubbles (sent), selected states   |
| Secondary         | Tone 40             | Tone 80    | Filter chips, secondary actions        |
| Surface           | #FFF8F6             | #1A1110    | Backgrounds, cards                     |
| Surface-Container | Tone 94             | Tone 12    | Elevated surfaces, bottom sheets       |
| Outline           | Tone 50             | Tone 60    | Borders, dividers                      |
| Error             | #BA1A1A             | #FFB4AB    | Validation errors, destructive actions |

For a chat application, **recommended primary color**: a distinctive blue or teal (similar to Telegram's #0088CC) that differentiates from competitors while conveying trust. Generate full tonal palettes using Google's Material Theme Builder tool, which outputs **13 tones per key color** using the HCT color space.

**Token naming convention** follows: `--md-sys-color-primary` for system tokens, `--md-ref-palette-primary-40` for reference values.

### Typography scale implementation

M3 defines **15 typography tokens** across five roles. For chat applications, prioritize these specific styles:

| Token        | Size | Line Height | Weight | Chat Application Usage        |
| ------------ | ---- | ----------- | ------ | ----------------------------- |
| Title Large  | 22sp | 28px        | 400    | Room names in headers         |
| Title Medium | 16sp | 24px        | 500    | Chat list names, sender names |
| Body Large   | 16sp | 24px        | 400    | Message text (default)        |
| Body Medium  | 14sp | 20px        | 400    | Secondary text, descriptions  |
| Body Small   | 12sp | 16px        | 400    | Timestamps, metadata          |
| Label Medium | 12sp | 16px        | 500    | Badges, button labels         |
| Label Small  | 11sp | 16px        | 500    | Distance indicators, status   |

**Font family**: Roboto for Android/Web, San Francisco for iOS. Users should be able to adjust message text size from **13sp to 22sp** (following Telegram's accessibility pattern).

### Spacing and layout grid

All components align to an **8dp baseline grid** with a 4dp sub-grid for fine adjustments:

| Spacing Token | Value | Usage                          |
| ------------- | ----- | ------------------------------ |
| xs            | 4dp   | Icon padding, inline spacing   |
| sm            | 8dp   | Component internal padding     |
| md            | 16dp  | Content margins, card padding  |
| lg            | 24dp  | Section spacing                |
| xl            | 32dp  | Major section dividers         |
| xxl           | 48dp  | Page margins on larger screens |

**Responsive breakpoints**:

- **Compact** (<600dp): 4-column grid, 16dp margins—single-column chat list
- **Medium** (600-839dp): 8-column grid, 24dp margins—master-detail possible
- **Expanded** (≥840dp): 12-column grid—persistent sidebar, split-view chat

---

## Chat interface specifications

### Message bubble design

Following Telegram's proven patterns with M3 refinements:

**Sent messages** (user's own):

- Background: `primary-container` color
- Text: `on-primary-container`
- Alignment: Right, with distinctive "tail" on bottom-right corner
- Max width: **75% of viewport width** (prevents full-width awkwardness)
- Border radius: **16dp** default, with 4dp on adjacent corners when messages are grouped
- Padding: 8dp vertical, 12dp horizontal, plus **53dp right margin** for timestamp space

**Received messages**:

- Background: `surface-variant` or `surface-container`
- Text: `on-surface`
- Alignment: Left, tail on bottom-left
- Same dimensional specifications as sent messages

**Message grouping logic**: Consecutive messages from the same sender within **60 seconds** share a bubble cluster—only the final message displays a tail. Timestamps appear every **5-10 messages** or when gaps exceed 5 minutes, displayed as centered date pills.

### Timestamps and read receipts

- **Timestamp format**: Relative time inside bubble—"2:34 PM" on same day, "Yesterday", or "Mon" for older
- **Size**: Label Small (11sp), `on-surface-variant` color at 60% opacity
- **Position**: Inside bubble, bottom-right corner, 4dp from edges
- **Read receipts**: Single checkmark (sent) → Double checkmark (delivered) → Filled double checkmark (read)
- Receipt icons: 16dp, positioned left of timestamp

### Chat input bar component

**Dimensions and layout**:

- Total height: **56dp** minimum (expands with multi-line input)
- Horizontal padding: 8dp from screen edges
- Input field: Rounded pill shape, `surface-container-high` background, 40dp height
- Placeholder: "Message..." in `on-surface-variant` at 60% opacity

**Button arrangement** (left to right):

1. **Attachment** (paperclip icon, 24dp): Opens bottom sheet with Gallery, Camera, File, Location options
2. **Input field**: Flexible width, expands to 4 lines before scrolling
3. **Emoji** (smile icon): Inside input field, right side
4. **Send/Microphone** (morphing icon): 48dp touch target, transforms from microphone to send arrow when text exists

**Voice message recording**: Press-and-hold microphone triggers recording mode. Show waveform visualization, recording duration timer, and "slide left to cancel" instruction. Sliding up locks recording for hands-free mode.

### Media handling patterns

**Image/video messages**:

- Thumbnail: Rounded corners (12dp radius), max 280dp width
- Aspect ratio: Preserve original, constrain to 4:3 maximum
- Play indicator: Centered play button (48dp) with duration badge (bottom-right)
- Progress: Circular progress ring around file type icon during upload/download

**Voice messages**: Horizontal waveform visualization, play/pause button (40dp), duration display. Progress indicator overlays waveform during playback. Design following Telegram's distinctive blue waveform pattern.

**File attachments**: Document icon with file extension badge, filename (truncated with ellipsis), file size below.

---

## Room discovery and location features

### Distance-based room list

The primary discovery interface shows rooms sorted by proximity—a hybrid of Grindr's grid approach and Telegram's list efficiency:

**Room card component** (list item):

- Height: 72dp (two-line with avatar)
- Left: Room avatar (48dp circular) with optional activity indicator dot (8dp, positioned bottom-right of avatar)
- Center: Room name (Title Medium), member count + distance (Body Small)
- Right: Last activity timestamp, unread badge if applicable

**Distance display formatting**:

- Under 500ft/150m: Show exact feet/meters ("320 ft away")
- 500ft-1mi: Round to 0.1 precision ("0.3 mi")
- Beyond 1mi: Round to nearest 0.1 mi ("2.4 mi")
- Include setting toggle for metric/imperial preference

**Alternative grid view** (for high-density discovery):

- Card size: Square aspect ratio, 3 columns on mobile
- Card content: Room image/avatar dominant, name overlay at bottom with member count and distance badge
- Tap behavior: Opens room preview bottom sheet before joining

### Map-based discovery interface

Implement toggle between list and map views via segmented button in header:

**Map specifications**:

- Default zoom: Show rooms within 2-mile radius
- Pin markers: Custom brand-colored pins, 32dp height
- Clustering: Aggregate overlapping pins when >3 would overlap, showing count badge
- Card overlay: Tapping pin reveals bottom sheet (25% screen height) with room preview
- "Locate me" button: FAB-style button (40dp) in bottom-right, 16dp margin

**Room location algorithm display**: Since rooms use 40% creator location + 60% member locations, show approximate area indicator—a subtle circular range visualization rather than exact pin when privacy mode is enabled.

### Privacy controls interface

**Settings panel structure**:

- "Show my distance" toggle (default ON)—hides exact distance but still sorts by proximity
- "Appear in discovery" toggle—complete invisibility from browse/search
- "Location precision" selector: Exact / Approximate (±0.5mi) / Hidden
- Ghost mode (premium): Fully invisible while still able to browse

**Permission request flow** (achieving up to 93% opt-in rates):

1. **Pre-permission primer screen** when user taps location feature: Illustration + "Find rooms near you" headline + "We'll show you active chats in your area" + "Continue" button + "Not now" secondary action
2. **Reiteration screen** if initially declined: More specific value proposition + "Enable in settings" deep-link
3. **Fallback**: Manual location entry by city/neighborhood + explanation of limited functionality

---

## Room management and member experience

### Room creation flow

**Minimal viable flow** (3 steps):

1. **Name and description**: Room name required (30 char max), description optional (250 char max)
2. **Room type**: Public (discoverable) / Private (invite-only) toggle
3. **Location confirmation**: Map pin showing proposed room location, option to adjust

**Optional enhancements** (available in room settings):

- Room icon/photo upload (512×512px recommended)
- Category tags (social, LGBTQ+, students, neighbors, events, etc.)
- Member capacity limit
- Message expiration timer

### Member list design

Following Discord's effective patterns:

**Member sidebar** (expanded view on tablet/desktop, bottom sheet on mobile):

- Header: "[X] members" with search icon
- Grouping: Online members first, then recently active, then others
- Status indicators: Green dot (online), yellow moon (idle), gray (offline)
- Role badges: Crown for creator, shield for moderators
- Touch action: Tap member → profile preview card → "Message" action to initiate DM

**Member presence** in chat:

- Typing indicator: "[Name] is typing..." with animated dots, appears above input bar
- Read receipts in groups: "Seen by X" expandable to show member list
- Join/leave announcements: System message style, centered, muted color

### Moderation tools

**Admin quick actions** (via long-press on member or message):

- Remove message (with optional "Remove all by user")
- Mute member: Duration picker (1 hour, 24 hours, 7 days, permanent)
- Remove from room: Confirmation dialog with reason field
- Ban from room: Same as remove, prevents rejoining

**Room settings panel** (admin-only tabs):

- **General**: Name, description, icon, location
- **Permissions**: Who can post, who can invite, who can change info
- **Moderation**: Banned members list, muted members, spam filter toggle
- **Danger zone**: Archive room, delete room (with confirmation)

---

## Authentication and onboarding

### Multi-method authentication screen

**Login/signup screen layout**:

1. App logo + tagline (top 30% of screen)
2. "Continue with Google" button (filled, full-width, 56dp height)—required per Apple guidelines when offering any social login
3. "Continue with Apple" button (if iOS)
4. Divider: "or" with horizontal lines
5. "Continue with phone" text button
6. "Continue with email" text button
7. "Continue as guest" text button (lowest emphasis)

**Social login buttons** must follow platform guidelines: Google "G" logo with "Sign in with Google" text in Roboto Medium; Apple button at least as prominent as other options.

### Anonymous/guest mode implementation

- Create temporary user with device-generated ID
- Store session locally; persist across app restarts
- **Limitations**: Cannot create rooms, cannot send DMs (can chat in public rooms only)
- **Upgrade prompt**: Contextual when user attempts restricted action—"Create an account to start private conversations" with clear benefit statement
- **Data migration**: When guest converts to full account, migrate all activity history

### Phone number authentication UI

**Phone input design**:

- Country selector dropdown with flag + code (auto-detect from device locale)
- Phone field with auto-formatting as user types
- "Send code" button enables after valid format detected

**Verification code entry**:

- 6 separate digit input boxes (48dp each)
- Numeric keyboard only
- Auto-advance cursor between boxes
- Auto-submit when complete
- Countdown timer: "Resend code in 45s"—enable resend after delay

### Onboarding flow

**First-time user experience** (3-4 screens max):

1. **Value proposition**: "Discover conversations happening around you" + illustration
2. **Location permission primer**: Explain why needed + what user gains
3. **Profile setup** (optional skip): Display name + optional avatar
4. **Discovery**: Immediately show populated room list with "empty state" fallback if no nearby rooms

**Empty state for new users**:

- Friendly illustration
- "No rooms nearby yet"
- "Be the first—create a room for your area" CTA
- Alternative: "Explore popular rooms" (showing featured non-local rooms)

---

## Mobile interaction patterns

### Navigation architecture

**Bottom navigation bar** (primary navigation):

- 4 destinations: Discover (compass), My Rooms (chat bubble), DMs (message), Profile (person)
- Active state: Filled icon + label + primary color indicator
- Badge: Unread count on relevant tabs
- Specification: 80dp height including safe area, 24dp icons

**In-conversation header**:

- Back arrow (48dp touch target)
- Room avatar (40dp)
- Room name + member count (tappable → room info sheet)
- Right actions: Search (magnifier), More (three dots) → call, mute, leave options

### Touch targets and gestures

**Minimum touch targets**: 48×48dp for all interactive elements (Material standard), with 8dp minimum spacing between targets.

**Thumb-zone optimization**: Place primary actions in bottom-center arc. FAB position: bottom-right, 16dp from edges. Critical navigation via bottom bar within easy thumb reach.

**Chat-specific gestures**:

- **Swipe right on message**: Reveal reply action (partial swipe shows preview, full swipe triggers)
- **Long-press message**: Context menu with Reply, Copy, Forward, Delete, React
- **Double-tap message**: Quick-react with default emoji (configurable)
- **Pull down at conversation top**: Load older messages

### Loading and feedback states

**Skeleton screens** for initial data load:

- Chat list: Gray rounded rectangles mimicking avatar + text layout
- Shimmer animation: Left-to-right gradient sweep, 800ms duration
- Replace progressively as data arrives

**Optimistic UI** for sent messages:

- Message appears immediately in bubble with clock icon
- Transitions to single check when server confirms
- Rollback with error indicator if send fails

**Snackbar notifications**:

- Height: 48dp
- Position: Bottom, above navigation bar, 8dp margin
- Duration: 4 seconds (short), 7 seconds with action
- Actions: Single text button, right-aligned

---

## Component specification summary

### Critical dimensions reference

| Component                | Specification                             |
| ------------------------ | ----------------------------------------- |
| Chat list item height    | 72dp (two-line)                           |
| Avatar sizes             | 32dp (small), 48dp (medium), 72dp (large) |
| Message bubble max-width | 75% of screen                             |
| Message bubble padding   | 8dp × 12dp                                |
| Message bubble radius    | 16dp (4dp on grouped corners)             |
| Input bar height         | 56dp minimum                              |
| FAB size                 | 56dp (standard), 40dp (mini)              |
| Bottom sheet peek        | 25-30% screen height                      |
| Bottom nav height        | 80dp including safe area                  |
| Touch target minimum     | 48×48dp                                   |
| Modal dialog width       | 280-560dp                                 |
| Modal corner radius      | 28dp (M3)                                 |

### Motion specifications

| Transition             | Duration | Easing                |
| ---------------------- | -------- | --------------------- |
| Button state change    | 100ms    | ease-out              |
| Page transition        | 300ms    | ease-in-out           |
| Bottom sheet open      | 250ms    | emphasized decelerate |
| Message send animation | 200ms    | ease-out              |
| Skeleton shimmer       | 800ms    | linear                |
| Snackbar enter         | 150ms    | ease-out              |
| Snackbar exit          | 75ms     | ease-in               |

**Easing curves** (cubic-bezier):

- Standard: `(0.4, 0.0, 0.2, 1)`
- Emphasized decelerate: `(0.05, 0.7, 0.1, 1.0)`
- Emphasized accelerate: `(0.3, 0.0, 0.8, 0.15)`

---

## Dark mode implementation

M3 dark themes use **tonal surface containers** rather than pure black:

| Surface Level          | Light   | Dark    |
| ---------------------- | ------- | ------- |
| Background             | #FFF8F6 | #1A1110 |
| Surface                | #FFF8F6 | #1A1110 |
| Surface Container Low  | Tone 96 | Tone 10 |
| Surface Container      | Tone 94 | Tone 12 |
| Surface Container High | Tone 92 | Tone 17 |

Primary colors shift from **tone 40 (light) to tone 80 (dark)** for sufficient contrast. Container colors similarly invert.

**Implementation notes**:

- System preference detection: Follow OS dark mode setting by default
- Manual override: Toggle in app settings
- Transition: Fade animation (200ms) when switching themes
- Test all color combinations for **4.5:1 contrast ratio** (WCAG AA)

---

## Accessibility requirements

**Touch targets**: 48×48dp minimum, 44×44pt on iOS
**Color contrast**: 4.5:1 for normal text, 3:1 for large text (18sp+) and UI components
**Focus indicators**: Visible ring on keyboard navigation, 2dp minimum thickness
**Screen reader support**: All interactive elements have accessible labels; images have alt text
**Reduced motion**: Respect system preference, provide option to minimize animations
**Text scaling**: Support up to 200% text size increase without layout breakage

---

## Figma implementation recommendations

1. **Create token library first**: Define all color, typography, and spacing tokens as Figma variables
2. **Build atomic components**: Buttons, inputs, avatars, badges as reusable components with variants
3. **Compose molecules**: Message bubbles, room cards, member list items from atoms
4. **Design key screens**: Discovery list, room chat, DM conversation, profile, settings
5. **Create user flows**: Onboarding, room creation, joining room, sending message, DM initiation
6. **Document interactions**: Prototype gesture interactions, state transitions, loading sequences
7. **Test responsively**: Verify layouts at 360dp (mobile), 768dp (tablet), 1366dp (desktop)

This specification provides the foundational patterns needed to create a cohesive, intuitive location-based chat experience. The combination of Telegram's messaging efficiency, Material Design 3's systematic approach, and location-aware discovery patterns creates a powerful framework for connecting people based on proximity.
