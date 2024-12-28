# BookMind

BookMind is a sophisticated web application designed to provide users with personalized book recommendations based on their preferences. The application leverages modern web technologies and AI to deliver a seamless and engaging user experience.

## Project Structure

-   **Frontend**: Built with Vue 3, utilizing the Composition API for a modern, reactive UI.
-   **State Management**: Managed with Pinia for efficient and scalable state handling.
-   **Routing**: Implemented using Vue Router for dynamic and nested routes.
-   **Styling**: Tailwind CSS is used for responsive and utility-first styling.
-   **Internationalization**: Vue I18n is integrated for multi-language support.
-   **Backend**: Built with FastAPI for high-performance API development.

## Technology Stack

-   **Vue 3**: The core framework for building the user interface.
-   **TypeScript**: Ensures type safety and enhances code maintainability.
-   **Tailwind CSS**: Provides a utility-first approach to styling, ensuring a responsive design.
-   **Firebase**: Used for authentication and real-time database capabilities.
-   **OpenAI API**: Powers the AI-driven book recommendation engine.
-   **Vite**: A fast build tool and development server for modern web projects.
-   **FastAPI**: A modern, fast (high-performance) web framework for building APIs with Python 3.7+.
-   **Uvicorn**: A lightning-fast ASGI server implementation, using `uvloop` and `httptools`.

## Backend Setup

Follow these steps to set up and run the Python backend server:

### 1. Navigate to the Backend Directory

```sh
cd bookmind-server
```

### 2. Create a Virtual Environment

Create a Python virtual environment to manage project dependencies.

```sh
python -m venv venv
```

### 3. Activate the Virtual Environment

- **On macOS/Linux:**

    ```sh
    source venv/bin/activate
    ```

- **On Windows:**

    ```sh
    venv\Scripts\activate
    ```

### 4. Create `requirements.txt`

If you haven't created a `requirements.txt` file yet, do so now with the following dependencies:

```sh
touch requirements.txt
```

Then, add the following content to `requirements.txt`:

```text
fastapi>=0.104.0
uvicorn>=0.24.0
python-dotenv>=1.0.0
openai>=1.3.0
pydantic>=2.4.2
python-multipart>=0.0.6
firebase-admin>=5.0.0
```

### 5. Install Backend Dependencies

Install all necessary Python packages using `pip`:

```sh
pip install -r requirements.txt
```

### 6. Environment Configuration

1. **Create a `.env` File**

    In the `bookmind-server` directory, create a `.env` file to store your environment variables:

    ```sh
    touch .env
    ```

2. **Add Environment Variables**

    Add your OpenAI API key and Firebase credentials to the `.env` file:

    ```env
    OPENAI_API_KEY=your_openai_api_key
    FIREBASE_API_KEY=your_firebase_api_key
    FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    FIREBASE_PROJECT_ID=your_project_id
    FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
    FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    FIREBASE_APP_ID=your_app_id
    GOOGLE_BOOKS_API_KEY=your_google_books_api_key
    ```

    **Note:** Replace `your_*` with your actual credentials.

### 7. Enable Required Google APIs

Ensure that the following APIs are enabled for your project in the Google Cloud Console:

- **Books API**
- **Identity Toolkit API**
- **Firestore API**

**Steps to Enable APIs:**

1. **Access Google Cloud Console APIs Library:**

    - [Books API](https://console.cloud.google.com/apis/library/books.googleapis.com)
    - [Identity Toolkit API](https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com)
    - [Firestore API](https://console.cloud.google.com/apis/library/firestore.googleapis.com)

2. **Enable Each API:**

    - Click on the **"Enable"** button for each API.

3. **Wait for Propagation:**

    - It may take a few minutes for the changes to take effect.

### 8. Run the FastAPI Server

Start the backend server using Uvicorn:

```sh
uvicorn main:app --reload
```

- The backend server will be running at `http://127.0.0.1:8000`.
- You can access the automatic API documentation at `http://127.0.0.1:8000/docs`.

**Troubleshooting Tips:**

- **Missing `requirements.txt` Error:**

    If you encounter an error stating that `requirements.txt` is missing, ensure that you've created the file in the correct directory (`bookmind-server`) and that it contains all necessary dependencies.

- **API Permission Errors:**

    - Verify that all required APIs are enabled in the Google Cloud Console.
    - Ensure that your `.env` file contains the correct API keys.
    - Wait a few minutes after enabling APIs for the changes to propagate.

- **Virtual Environment Issues:**

    If you face issues with the virtual environment, try recreating it:

    ```sh
    deactivate
    rm -rf venv
    python -m venv venv
    source venv/bin/activate  # or venv\Scripts\activate on Windows
    pip install -r requirements.txt
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
