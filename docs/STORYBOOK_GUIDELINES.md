# Storybook Documentation Guidelines

## Overview
This guide provides comprehensive documentation standards for the RoverMissionControl Storybook implementation. Follow these guidelines to maintain consistency and quality across all component documentation.

## Table of Contents
1. [Component Story Standards](#component-story-standards)
2. [MDX Documentation](#mdx-documentation)
3. [Design Token Usage](#design-token-usage)
4. [Accessibility Requirements](#accessibility-requirements)
5. [Theme Implementation](#theme-implementation)
6. [Visual Testing with Chromatic](#visual-testing-with-chromatic)
7. [Best Practices](#best-practices)

## Component Story Standards

### File Structure
```
packages/shared-ui/
├── components/
│   ├── Button/
│   │   ├── Button.tsx           # Component implementation
│   │   ├── Button.module.scss   # Component styles
│   │   ├── Button.stories.tsx   # Storybook stories
│   │   ├── Button.test.tsx      # Component tests
│   │   └── Button.mdx           # Component documentation
```

### Story Template
```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Components/Controls/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Mission-critical button component for rover operations.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'warning'],
      description: 'Visual style variant'
    },
    size: {
      control: 'radio',
      options: ['small', 'medium', 'large'],
      description: 'Button size'
    }
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Primary use case
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Execute Command'
  }
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="warning">Warning</Button>
    </div>
  )
};
```

## MDX Documentation

### Component Documentation Template
```mdx
import { Meta, Canvas, Story, Controls, Source } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button Component

Mission-critical button component designed for rover control interfaces.

## Overview

The Button component provides reliable user interaction points with built-in
safeguards for critical operations.

<Canvas of={ButtonStories.Primary} />

## Props

<Controls of={ButtonStories.Primary} />

## Usage Guidelines

### When to Use
- Primary actions (Execute, Deploy, Activate)
- Secondary navigation
- Confirmation dialogs
- Emergency stops

### Design Tokens
```scss
.button {
  // Always use design tokens
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-family: var(--font-interface);
  
  &--primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }
}
```

### Accessibility
- Minimum touch target: 44x44px
- WCAG AA contrast requirements
- Keyboard navigation support
- Screen reader announcements
```

## Design Token Usage

### Required Token Categories
1. **Colors**: Use semantic color tokens
   ```scss
   // ✅ Good
   background: var(--color-primary);
   color: var(--color-text-primary);
   
   // ❌ Bad
   background: #0B3D91;
   color: #000000;
   ```

2. **Spacing**: Use spacing scale
   ```scss
   // ✅ Good
   margin: var(--spacing-md);
   
   // ❌ Bad
   margin: 16px;
   ```

3. **Typography**: Use type system
   ```scss
   // ✅ Good
   font-size: var(--font-size-md);
   font-weight: var(--font-weight-semibold);
   
   // ❌ Bad
   font-size: 16px;
   font-weight: 600;
   ```

## Accessibility Requirements

### Component Checklist
- [ ] Keyboard navigation implemented
- [ ] ARIA labels provided
- [ ] Focus indicators visible
- [ ] Color contrast WCAG AA compliant
- [ ] Screen reader tested
- [ ] No motion without user preference check

### Testing in Storybook
```typescript
// Add accessibility tests
export const AccessibilityTest: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true
          }
        ]
      }
    }
  }
};
```

## Theme Implementation

### Component Theme Support
```typescript
// Component must support all themes
const Button: React.FC<ButtonProps> = ({ variant, ...props }) => {
  // Use CSS custom properties that adapt to themes
  return (
    <button 
      className={cn(
        styles.button,
        styles[`button--${variant}`]
      )}
      {...props}
    />
  );
};
```

### Theme Testing
Create stories for each theme:
```typescript
export const ThemedButtons: Story = {
  decorators: [
    (Story) => (
      <div className="theme-showcase">
        <div data-theme="nasa-operations"><Story /></div>
        <div data-theme="mission-control-dark"><Story /></div>
        <div data-theme="telemetry-green"><Story /></div>
        <div data-theme="high-contrast"><Story /></div>
      </div>
    )
  ]
};
```

## Visual Testing with Chromatic

### Snapshot Configuration
```typescript
// Mark stories for visual regression testing
export const VisualTest: Story = {
  parameters: {
    chromatic: {
      viewports: [375, 768, 1200], // Mobile, tablet, desktop
      delay: 300, // Wait for animations
      diffThreshold: 0.2 // Sensitivity
    }
  }
};
```

### Best Practices for Visual Tests
1. Test all component states
2. Include hover/focus states
3. Test responsive breakpoints
4. Verify theme variations
5. Check loading/error states

## Best Practices

### Do's
- ✅ Write stories for all component states
- ✅ Include error and edge cases
- ✅ Document props with JSDoc
- ✅ Use design tokens exclusively
- ✅ Test accessibility in every story
- ✅ Include usage examples
- ✅ Add keyboard interaction demos

### Don'ts
- ❌ Hard-code colors or dimensions
- ❌ Skip accessibility testing
- ❌ Create stories without documentation
- ❌ Ignore theme compatibility
- ❌ Omit error states
- ❌ Use inline styles

### Story Naming Convention
```
ComponentName
├── Default
├── [Variants] (Primary, Secondary, etc.)
├── [States] (Hover, Focus, Disabled, Loading)
├── [Sizes] (Small, Medium, Large)
├── WithIcon
├── Responsive
├── AllVariants (showcase)
└── Playground (fully interactive)
```

### Documentation Requirements
Every component must include:
1. Purpose and use cases
2. Props documentation with types
3. Design token usage examples
4. Accessibility considerations
5. Theme compatibility notes
6. Code examples
7. Do's and don'ts

## Review Checklist
Before submitting component documentation:
- [ ] All props documented
- [ ] Stories cover all states
- [ ] Accessibility tested
- [ ] Themes verified
- [ ] Visual regression tests added
- [ ] Design tokens used throughout
- [ ] MDX documentation complete
- [ ] Code examples provided

## Resources
- [Storybook Best Practices](https://storybook.js.org/docs/react/writing-docs/docs-page)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [NASA Human Interface Standards](https://www.nasa.gov/offices/ocio/ittalk/02-2013_his.html)
- [Component Driven Development](https://www.componentdriven.org/)

---

Last Updated: January 2025
Version: 1.0.0