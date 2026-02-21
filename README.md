# Senior Guardians

> Meet Senior Guardians, the voice-first AI that proactively calls seniors for daily medication reminders and wellness monitoring.

## Features

- 🎙️ **Voice-First AI** — Proactive phone calls to check in on seniors
- 💊 **Medication Reminders** — Personalized daily medication tracking and adherence monitoring
- ❤️ **Wellness Monitoring** — Mood detection, health logging, and alert system for caregivers
- 📊 **Dashboard & History** — Real-time overview of check-ins, medications, and health trends
- 👤 **Profile Management** — User profiles with avatar uploads and account settings
- 🔐 **Admin Panel** — Role-based access for caregivers and administrators

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **AI:** Voice chat and TTS integration
- **Animations:** Framer Motion

## Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/senior-guardians-open.git
   cd senior-guardians-open
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy the example environment file:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and fill in your Supabase credentials (you can find these in your Supabase project settings under API):
     ```env
     VITE_SUPABASE_PROJECT_ID="your-project-id"
     VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
     VITE_SUPABASE_URL="https://your-project-id.supabase.co"
     ```

### Running Locally

To start the development server, run:

```bash
npm run dev
```

Alternatively, you can use the provided script:

```bash
bash start.sh
```

The application will be available at `http://localhost:8080` (or another port if 8080 is in use).

## Contributing

Contributions are welcome! If you'd like to improve Senior Guardians, please check out the issues or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

**Albano Rocha**
📧 albanorocha@gmail.com
