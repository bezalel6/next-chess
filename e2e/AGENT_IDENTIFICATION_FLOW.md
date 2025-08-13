# Agent Identification Flow - UI Transformation System

## Overview
The agent identification system provides a visual transformation that optimizes the UI for each agent's role when they identify themselves using visible checkboxes.

## Identification Process

### 1. Initial State (Both Panels Visible)
- Both Master (green) and Sub (blue) message panels are visible
- Both input fields are displayed
- Container height: 120px
- Checkboxes visible at bottom-left

### 2. Agent Identification
Agent clicks their checkbox:
- **Master Agent**: Clicks `[data-testid="master-agent-checkbox"]`
- **Sub Agent**: Clicks `[data-testid="sub-agent-checkbox"]`

### 3. UI Transformation Animation (0.35s)

#### Horizontal Criss-Cross Effect
When an agent identifies, the UI transforms with opposing horizontal movements:

**Log Panel (Incoming Messages)**
- Slides from **left** side: `-100%` → `0`
- Height expands: `60%` → `100%`
- Shows only the OTHER agent's messages
- Animation timing: 0.35s with 0.15s delay

**Input Field (Own Messages)**
- Slides from **right** side: `100%` → `0` 
- Maintains constant height
- Used for sending messages as identified agent
- Animation timing: 0.35s with 0.15s delay

**Container**
- Height increases: `120px` → `140px`
- Transition: 0.3s ease

### 4. Final State (After Identification)

#### For Master Agent:
- **Visible**: Sub agent messages (blue) + Master input (green)
- **Hidden**: Master messages panel + Sub input
- **Header**: "INCOMING FROM SUB"
- **Input placeholder**: "Send as Master"

#### For Sub Agent:
- **Visible**: Master agent messages (green) + Sub input (blue)
- **Hidden**: Sub messages panel + Master input
- **Header**: "INCOMING FROM MASTER"
- **Input placeholder**: "Send as Sub"

## Animation Technical Details

```tsx
// Log animation (from left)
initial={{ x: '-100%', opacity: 0, height: '60%' }}
animate={{ x: 0, opacity: 1, height: '100%' }}
transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1], delay: 0.15 }}

// Input animation (from right)
initial={{ x: '100%', opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1], delay: 0.15 }}
```

## Benefits of This System

1. **Clear Role Separation**: Each agent sees only what they need
2. **Visual Feedback**: Smooth animations confirm identification
3. **Space Optimization**: Removes redundant UI elements
4. **Focus Enhancement**: Agent focuses on incoming messages and their responses
5. **No Hidden Elements**: All UI controls remain visible and accessible

## Testing Usage

### Master Agent Workflow
1. Navigate to test page
2. Click Master checkbox to identify
3. Wait for animation to complete
4. See only Sub messages in expanded log
5. Use Master input to send coordination messages

### Sub Agent Workflow
1. Navigate to test page
2. Click Sub checkbox to identify
3. Wait for animation to complete
4. See only Master messages in expanded log
5. Use Sub input to send status reports

## Key Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Master Checkbox | `[data-testid="master-agent-checkbox"]` | Identify as Master |
| Sub Checkbox | `[data-testid="sub-agent-checkbox"]` | Identify as Sub |
| Master Input | `[data-testid="master-message-input"]` | Send as Master |
| Sub Input | `[data-testid="sub-message-input"]` | Send as Sub |

## Important Notes

- Only one agent can be identified at a time
- Checking one checkbox automatically unchecks the other
- The animation is one-way (no reverse animation when unchecking)
- Input field retains multiline capability after transformation
- All messages persist across identification changes