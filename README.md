# AI-Powered Task Management & Scheduling Platform

A sophisticated task management application that combines intelligent AI scheduling, Google Calendar integration, and Canvas LMS synchronization to optimize your productivity and time management.

## 🚀 Overview

This platform revolutionizes how you manage tasks and schedules by leveraging artificial intelligence to automatically suggest optimal task scheduling based on your workload, priorities, and existing calendar commitments. Perfect for students, professionals, and anyone looking to maximize their productivity.

**Live Demo**: [View Application](https://lovable.dev/projects/b23cdb38-6a3d-4c13-96b9-6c88c10b8143)

## ✨ Key Features

### 🤖 AI-Powered Scheduling
- **Intelligent Task Suggestions**: AI analyzes your workload and automatically suggests optimal time slots for task completion
- **Context-Aware Planning**: Considers task priorities, deadlines, estimated duration, and existing calendar events
- **Smart Conflict Avoidance**: Ensures AI suggestions never overlap with Google Calendar events

### 📅 Google Calendar Integration
- **Seamless Synchronization**: Connect your Google Calendar to view and manage all commitments in one place
- **Real-Time Event Display**: Calendar events appear directly on your schedule timeline
- **OAuth 2.0 Security**: Secure authentication with automatic token refresh

### 📊 Advanced Scheduling Views
- **Timeline View**: Hourly breakdown of your day with visual task and event representation
- **Calendar View**: Monthly overview with task and event visualization
- **Mini Calendar**: Quick date navigation and task density indicators

### ⏱️ Focus Timer
- **Pomodoro Technique**: Built-in focus timer to enhance productivity
- **Task-Specific Timing**: Track time spent on individual tasks
- **Break Reminders**: Automated break suggestions

### 📈 Analytics Dashboard
- **Productivity Insights**: Visualize task completion rates and productivity trends
- **Time Analysis**: Understand how you spend your time
- **Goal Tracking**: Monitor progress toward completion goals

### 🔄 Recurring Tasks
- **Flexible Recurrence**: Support for daily, weekly, and custom recurring patterns
- **Smart Management**: Edit or delete individual instances or entire series
- **Automated Creation**: Recurring tasks automatically appear on scheduled dates

### 🎯 Task Management
- **Priority Levels**: Organize tasks by priority (Low, Medium, High)
- **Categories & Labels**: Categorize tasks for better organization
- **Subtasks & Details**: Add detailed descriptions and break down complex tasks
- **Completion Tracking**: Visual progress indicators and completion celebrations
- **Deleted Tasks Recovery**: Restore accidentally deleted tasks within 30 days

### 🔐 Secure Authentication
- **User Accounts**: Secure sign-up and login system
- **Profile Management**: Customize your profile and preferences
- **Data Privacy**: All user data encrypted and securely stored

### 🌓 Modern UI/UX
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Intuitive Interface**: Clean, modern design with smooth animations
- **Accessibility**: WCAG compliant for inclusive user experience

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI framework with hooks
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and development server
- **Tailwind CSS** - Utility-first styling with custom design system
- **shadcn/ui** - High-quality React component library
- **TanStack Query** - Powerful data synchronization and caching
- **React Router** - Client-side routing

### Backend & Infrastructure
- **Lovable Cloud (Supabase)** - Backend-as-a-Service
- **PostgreSQL** - Relational database with Row Level Security (RLS)
- **Edge Functions** - Serverless functions for AI and integrations
- **Real-time Subscriptions** - Live data updates

### Integrations
- **Google Calendar API** - Calendar synchronization with OAuth 2.0
- **Canvas LMS API** - Assignment and course data import
- **AI Services** - Intelligent task scheduling and suggestions

### Additional Tools
- **date-fns** - Modern date utility library
- **React Hook Form** - Performant form management
- **Zod** - Schema validation
- **Lucide React** - Beautiful icon system

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ and npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Git for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Environment Setup
The project uses Lovable Cloud, which automatically configures environment variables. No additional setup required for database and authentication.

## 📖 Usage Guide

### Creating Your First Task
1. Sign up or log in to your account
2. Click "Add Task" or use the task creation dialog
3. Fill in task details: title, description, priority, due date
4. Save and let the AI suggest optimal scheduling

### Connecting Google Calendar
1. Navigate to Profile page
2. Click "Connect Google Calendar"
3. Authorize the application
4. Your calendar events will automatically sync

### Getting AI Scheduling Suggestions
1. Add tasks to your dashboard
2. Click "Get AI Suggestions" on the Schedule page
3. Review AI-generated time slots
4. Accept or modify suggestions as needed

### Syncing Canvas Assignments
1. Go to Profile settings
2. Enter your Canvas API credentials
3. Click "Sync Canvas"
4. Assignments will import automatically

## 🎨 Design Philosophy

This application follows a comprehensive design system with semantic color tokens, ensuring consistency across all components. The UI adapts seamlessly to light and dark modes, providing an optimal viewing experience in any lighting condition.

## 🔒 Security & Privacy

- **Row Level Security (RLS)**: Database-level security ensures users can only access their own data
- **OAuth 2.0**: Industry-standard authentication for Google Calendar
- **Encrypted Storage**: All sensitive data encrypted at rest
- **Automatic Token Refresh**: Secure token management with no manual intervention

## 📱 Responsive Design

Fully responsive interface optimized for:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🤝 Contributing

### Development Workflow
1. Create a new branch for your feature
2. Make your changes following the existing code style
3. Test thoroughly across different screen sizes
4. Submit a pull request with a clear description

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Semantic component naming
- Design system compliance

## 📄 License

This project is part of the Lovable platform. See [Lovable Documentation](https://docs.lovable.dev) for more information.

## 🌐 Deployment

### Quick Deploy
Simply open [Lovable](https://lovable.dev/projects/b23cdb38-6a3d-4c13-96b9-6c88c10b8143) and click Share → Publish.

### Custom Domain
Navigate to Project → Settings → Domains to connect your custom domain.

## 📞 Support & Resources

- **Documentation**: [Lovable Docs](https://docs.lovable.dev)
- **Community**: [Discord Server](https://discord.com/channels/1119885301872070706/1280461670979993613)
- **Tutorials**: [YouTube Playlist](https://www.youtube.com/watch?v=9KHLTZaJcR8&list=PLbVHz4urQBZkJiAWdG8HWoJTdgEysigIO)

## 🎯 Future Roadmap

- Email notifications for upcoming tasks
- Team collaboration features
- Mobile native applications
- Advanced analytics and reporting
- Integration with additional calendar services
- Voice input for task creation
- Smart task delegation

---

**Built with ❤️ using [Lovable](https://lovable.dev)** - The fastest way to build modern web applications
