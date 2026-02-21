# Senior Guardians

A modern, mobile-first web application designed to help caregivers and families monitor and log symptoms, track medication, and view notifications for seniors. Built with a React, Vite, TypeScript, and Tailwind CSS tech stack, and powered by Supabase.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Contributing](#contributing)
- [License](#license)

## Features
- **Mobile-first Design**: Built with responsive design principles ensuring a great experience on any device.
- **Symptom Logging**: Easily log and track daily symptoms to keep a detailed health history.
- **Notifications**: Stay up to date with alerts and scheduled medications.
- **Dashboard**: A comprehensive overview of recent logs, scheduled activities, and health alerts.
- **Supabase Integration**: Secure authentication and real-time database syncing.

## Tech Stack
- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Radix UI (shadcn/ui), Framer Motion
- **Routing**: React Router
- **Data Fetching**: React Query
- **Icons**: Lucide React
- **Backend & Database**: Supabase

## Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed along with `npm` or `yarn` (or `pnpm`).

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/albanorocha/senior-guardians.git
   cd senior-guardians
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables
This project requires environment variables to connect to Supabase.
1. Copy the example `.env` file to create your own local copy:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
   VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
   VITE_SUPABASE_URL="https://your_supabase_project_id.supabase.co"
   ```

> [!WARNING]
> Please do not commit your real `.env` or `.env.local` files! The `.gitignore` is already set up to ignore them. Use `.env.example` as a template for other developers.

### Running the App
Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

## Contributing
Contributions are always welcome! If you have any ideas, feel free to open an issue or fork the repository and submit a Pull Request.
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
Distributed under the MIT License. See `LICENSE` for more information.
