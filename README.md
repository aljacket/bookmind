# BookMind

BookMind is a Vue 3 application that helps users discover new books based on their preferences. It uses AI-powered recommendations to suggest personalized reading lists.

## Features

-   User authentication
-   Personalized book recommendations
-   User preference management
-   Responsive design optimized for various devices

## Technologies Used

-   Vue 3
-   TypeScript
-   Tailwind CSS
-   Firebase Authentication
-   IndexedDB for local storage
-   OpenAI API for book recommendations

## Getting Started

### Prerequisites

-   Node.js (v14 or later)
-   npm (v6 or later)

### Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/your-username/bookmind.git
    cd bookmind
    ```

2. Install dependencies:

    ```sh
    npm install
    ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Firebase and OpenAI API credentials:
    ```
    VITE_FIREBASE_API_KEY=your_firebase_api_key
    VITE_OPENAI_API_KEY=your_openai_api_key
    ```

### Development

Run the development server:
npm run dev

## Recommended IDE Setup

We recommend using [VSCode](https://code.visualstudio.com/) with the [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension for the best development experience. Make sure to disable Vetur if you have it installed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
