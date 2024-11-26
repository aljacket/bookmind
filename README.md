# BookMind

BookMind is a sophisticated web application designed to provide users with personalized book recommendations based on their preferences. The application leverages modern web technologies and AI to deliver a seamless and engaging user experience.

## Project Structure

-   **Frontend**: Built with Vue 3, utilizing the Composition API for a modern, reactive UI.
-   **State Management**: Managed with Pinia for efficient and scalable state handling.
-   **Routing**: Implemented using Vue Router for dynamic and nested routes.
-   **Styling**: Tailwind CSS is used for responsive and utility-first styling.
-   **Internationalization**: Vue I18n is integrated for multi-language support.

## Technology Stack

-   **Vue 3**: The core framework for building the user interface.
-   **TypeScript**: Ensures type safety and enhances code maintainability.
-   **Tailwind CSS**: Provides a utility-first approach to styling, ensuring a responsive design.
-   **Firebase**: Used for authentication and real-time database capabilities.
-   **OpenAI API**: Powers the AI-driven book recommendation engine.
-   **Vite**: A fast build tool and development server for modern web projects.

## Project Scaffolding

The project is organized into a modular structure to enhance maintainability and scalability:

```
bookmind/
├── android/                # Android-specific files for Capacitor
├── ios/                    # iOS-specific files for Capacitor
├── public/                 # Static assets
├── src/                    # Source files
│   ├── assets/             # Images, fonts, etc.
│   ├── components/         # Vue components
│   │   └── layout/         # Layout components like Header, Footer
│   ├── locales/            # Localization files
│   ├── plugins/            # Vue plugins
│   ├── router/             # Vue Router configuration
│   ├── services/           # API services and Firebase configuration
│   ├── stores/             # Pinia stores
│   ├── styles/             # Global styles and Tailwind configuration
│   ├── types/              # TypeScript interfaces and types
│   ├── views/              # Vue views/pages
│   ├── App.vue             # Main Vue component
│   └── main.ts             # Entry point for the application
├── .env.example            # Example environment variables
├── .eslintrc.cjs           # ESLint configuration
├── .gitignore              # Git ignore file
├── .prettierrc.json        # Prettier configuration
├── index.html              # Main HTML file
├── package.json            # NPM package configuration
├── README.md               # Project documentation
└── vite.config.ts          # Vite configuration
```

## Development Workflow

### Prerequisites

-   **Node.js**: Version 14 or later is required.
-   **npm**: Version 6 or later is needed for package management.

### Setup Instructions

1. **Clone the Repository**:

    ```sh
    git clone https://github.com/your-username/bookmind.git
    cd bookmind
    ```

2. **Install Dependencies**:

    ```sh
    npm install
    ```

3. **Environment Configuration**:

    - Create a `.env` file in the root directory.
    - Add your Firebase and OpenAI API credentials:
        ```
        VITE_FIREBASE_API_KEY=your_firebase_api_key
        VITE_OPENAI_API_KEY=your_openai_api_key
        ```

4. **Run the Development Server**:
    ```sh
    npm run dev
    ```

### Recommended Tools

-   **IDE**: Visual Studio Code (VSCode) is recommended for development.
-   **Extensions**: Install the Volar extension for Vue 3 support and disable Vetur if installed.

## Contribution Guidelines

-   Contributions are welcome! Please submit a Pull Request for any enhancements or bug fixes.
-   Ensure code quality by adhering to the project's coding standards and running tests before submitting.

## License

This project is licensed under the MIT License. For more details, see the [LICENSE](LICENSE) file.
