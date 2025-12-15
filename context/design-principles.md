# Kollab Music App - Design Principles

> Guidelines for creating a premium, musician-focused mobile experience.

---

## Core Philosophy

**"Invisible until needed, powerful when used."**

Kollab's UI should fade into the background during creative flow, surfacing controls precisely when musicians need them. Every pixel serves the music.

---

## 1. Dark Theme Excellence

### Depth Through Darkness
Use layered backgrounds to create visual hierarchy:
```
Layer 0 (Base):     #0F0F0F  - True black for OLED efficiency
Layer 1 (Surface):  #1A1A1A  - Cards, modals, elevated surfaces
Layer 2 (Elevated): #262626  - Active states, hover, focus
Layer 3 (Accent):   #404040  - Borders, subtle dividers
```

### Contrast Ratios
- Body text on backgrounds: **7:1 minimum** (WCAG AAA)
- UI elements: **4.5:1 minimum** (WCAG AA)
- Large text/headings: **3:1 minimum**
- Never use pure white (#FFFFFF) for large areas - use #F5F5F5 or #E5E5E5

### Glow and Highlights
- Primary actions can use subtle glow: `shadowColor: '#6366F1', shadowOpacity: 0.3`
- Active audio tracks: subtle pulse animation
- Avoid harsh, bright UI elements that strain eyes in dark environments

---

## 2. Audio-Centric Visual Language

### Waveform Design
- Use smooth, anti-aliased rendering
- Fill color should be semi-transparent (0.6-0.8 opacity)
- Playhead: 2px width, primary color with subtle glow
- Selection: primary color at 0.2 opacity
- Ensure 60fps during playback

### Stem Color System
Each audio category has a semantic color:
```
Vocals:  #F59E0B (Amber)   - Warm, human
Drums:   #EF4444 (Red)     - Energy, rhythm
Bass:    #8B5CF6 (Purple)  - Deep, foundational
Guitar:  #10B981 (Green)   - Organic, natural
Keys:    #3B82F6 (Blue)    - Clean, precise
Synth:   #EC4899 (Pink)    - Electronic, modern
Other:   #6B7280 (Gray)    - Neutral
```

### Playback Controls
- Play/pause: Prominent, thumb-accessible (bottom-right for right-handed)
- Timeline scrubbing: Large touch target, haptic feedback at markers
- Volume: Vertical slider for precision
- Transport: Group logically (skip, play, loop)

---

## 3. Touch-First Interaction

### Touch Targets
- **Minimum**: 44x44pt (Apple HIG)
- **Recommended**: 48x48pt for primary actions
- **Spacing**: 8pt minimum between targets

### Gestures
| Gesture | Action |
|---------|--------|
| Tap | Select, play/pause |
| Long press | Context menu, multi-select |
| Swipe horizontal | Timeline scrub, dismiss |
| Swipe vertical | Scroll, volume adjust |
| Pinch | Timeline zoom |
| Two-finger tap | Quick action (configurable) |

### Feedback
- Haptic: Light impact on selection, medium on actions
- Visual: Scale down 0.97x on press, spring back
- Audio: Optional UI sounds (respect system settings)

---

## 4. Typography Hierarchy

### Scale (Base: 14px)
```
Hero:      32px  - App title, onboarding
H1:        24px  - Screen titles
H2:        20px  - Section headers
H3:        18px  - Card titles
Body Large: 16px  - Primary content
Body:      14px  - Default text
Caption:   12px  - Metadata, timestamps
Tiny:      10px  - Labels, badges
```

### Weights
- **Bold (700)**: Titles, emphasis
- **Semibold (600)**: Buttons, navigation
- **Medium (500)**: Subheadings
- **Regular (400)**: Body text
- **Light (300)**: Captions, secondary (use sparingly)

### Line Height
- Headings: 1.2x
- Body: 1.5x
- Captions: 1.4x

---

## 5. Motion & Animation

### Principles
1. **Purposeful**: Every animation communicates state change
2. **Quick**: 200-300ms for most transitions
3. **Natural**: Use spring physics, not linear easing
4. **Respectful**: Honor `prefers-reduced-motion`

### Timing
```
Instant:    0-100ms   - Feedback (button press)
Fast:       100-200ms - Small transitions (toggle, fade)
Normal:     200-300ms - Page transitions, modals
Slow:       300-500ms - Complex animations, onboarding
```

### Easing
- **Enter**: `Easing.out(Easing.cubic)` - Decelerate in
- **Exit**: `Easing.in(Easing.cubic)` - Accelerate out
- **Move**: `Easing.inOut(Easing.cubic)` - Smooth both
- **Spring**: `{ damping: 15, stiffness: 150 }` - Bouncy, alive

### Audio Sync
- Visual feedback should sync with audio events
- Waveform updates: 30fps minimum during playback
- Beat markers: Snap to grid visually

---

## 6. Spacing System

### Base Unit: 4px
```
xxs:  4px   - Tight grouping
xs:   8px   - Related elements
sm:   12px  - Default padding
md:   16px  - Card padding, list items
lg:   24px  - Section spacing
xl:   32px  - Major sections
xxl:  48px  - Screen margins (tablet)
```

### Application
- **Inline spacing**: xs-sm between related elements
- **Component padding**: md for cards and containers
- **Screen padding**: md (mobile), xl (tablet)
- **Section separation**: lg-xl

---

## 7. Component Patterns

### Cards
```typescript
{
  backgroundColor: Colors.surface,
  borderRadius: BorderRadius.lg, // 16px
  padding: Spacing.md,
  // Subtle border for definition
  borderWidth: 1,
  borderColor: Colors.border,
}
```

### Buttons
- **Primary**: Solid primary color, white text
- **Secondary**: Transparent, primary color border and text
- **Ghost**: No background, text only
- **Destructive**: Error color, use sparingly

### Inputs
- Clear labels above fields
- Placeholder text at 50% opacity
- Focus state: Primary color border (2px)
- Error state: Error color border + message below

### Lists
- Consistent item height (56-72pt)
- Clear separators or spacing
- Swipe actions on right (delete, archive)
- Pull-to-refresh at top

---

## 8. Accessibility Checklist

### Required
- [ ] All images have alt text / accessible labels
- [ ] Touch targets ≥ 44pt
- [ ] Color contrast meets WCAG AA
- [ ] Focus states visible
- [ ] Screen reader navigation logical
- [ ] No information conveyed by color alone

### Recommended
- [ ] Support Dynamic Type (iOS)
- [ ] Respect reduced motion preference
- [ ] Provide haptic alternatives to audio cues
- [ ] Test with VoiceOver / TalkBack

---

## 9. Platform Conventions

### iOS
- Use SF Pro font system
- Respect safe areas (notch, home indicator)
- Swipe from edge to go back
- Standard navigation bar height: 44pt
- Tab bar height: 49pt (83pt with home indicator)

### Android
- Material Design 3 influence
- Navigation bar at bottom
- Respect system navigation gestures
- Standard app bar height: 56dp

### Cross-Platform
- Consistent core experience
- Platform-specific polish where expected
- Never break platform navigation patterns

---

## 10. Performance Targets

### Visual
- 60fps for all animations
- < 100ms touch response
- < 16ms per frame during playback

### Assets
- Images: WebP format, responsive sizes
- Icons: Vector (SVG or icon font)
- Audio waveforms: Pre-computed, cached

### Memory
- Virtualize long lists
- Lazy load off-screen content
- Release audio resources when not in use

---

## Reference Apps

Study these for inspiration:

| App | Learn From |
|-----|------------|
| **Spotify** | Navigation, dark theme, audio UI |
| **Ableton Note** | Mobile music creation UX |
| **SoundCloud** | Waveforms, social audio |
| **Linear** | Polish, animations, dark mode |
| **Discord** | Chat UI, real-time features |
| **Figma Mobile** | Collaboration patterns |

---

## Anti-Patterns to Avoid

- Generic "shadcn purple" - use your own identity
- Bright white elements in dark theme
- Tiny touch targets for audio controls
- Blocking UI during audio operations
- Inconsistent spacing and typography
- Ignoring platform conventions
- Over-animating (distracting from content)
- Using color as the only indicator
