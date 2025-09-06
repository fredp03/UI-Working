# Video Party React App

This is a React conversion of the original Video Party application. The app has been converted from vanilla HTML/CSS/JavaScript to a modern React application using Vite.

## Features

- **User Selection Screen**: Choose between Fred and Avalene
- **Password Authentication**: Enter password to access the app (password: "password")
- **Loading Screen**: Animated loading spinner
- **Video Player Screen**: Main video interface with chat functionality
- **Movie Selection Screen**: Browse and select movies
- **Interactive Chat**: Real-time chat functionality with message history
- **Keyboard Shortcuts**: 
  - ESC: Navigate back
  - Ctrl/Cmd + M: Open movie selection (from video player)
  - Ctrl/Cmd + C: Toggle chat (from video player)

## Technology Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast development server and build tool
- **CSS**: Original styling preserved with responsive design
- **Inter Font**: Google Fonts integration

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the local development URL (typically `http://localhost:5173`)

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── UserSelectScreen.jsx
│   ├── PasswordScreen.jsx
│   ├── LoadingScreen.jsx
│   ├── VideoPlayerScreen.jsx
│   └── MovieSelectionScreen.jsx
├── App.jsx
├── main.jsx
└── index.css
```

## Component Overview

- **App.jsx**: Main application component with state management and routing
- **UserSelectScreen**: Initial screen for selecting a user
- **PasswordScreen**: Password authentication with validation and error handling
- **LoadingScreen**: Animated loading spinner
- **VideoPlayerScreen**: Main video interface with chat functionality
- **MovieSelectionScreen**: Movie browsing and selection interface

## State Management

The application uses React's built-in state management with hooks:
- `useState` for component-level state
- `useEffect` for side effects and event listeners
- Props for parent-child communication

## Responsive Design

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile devices

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Original vs React Version

### What's Preserved:
- All original styling and animations
- User interface and user experience
- Keyboard shortcuts
- Responsive design
- Visual effects (shake animations, loading spinner)

### What's Improved:
- Modern React architecture
- Component-based structure
- Better state management
- Improved maintainability
- Type safety ready (can be converted to TypeScript)
- Hot module replacement for development

## Development Notes

- The password is hardcoded as "password" for demonstration purposes
- Chat messages are stored in local component state (could be connected to a real chat service)
- Movie selection currently logs selection and returns to video player (ready for backend integration)
- All animations and transitions from the original have been preserved
