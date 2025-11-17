Place your uploaded MAI image in the project's public folder so it can be served at the root path.

Steps:
1. Copy the file you uploaded (e.g. Screenshot_6-8-2025_184649_looka.com.jpeg) into the project `public` folder.
2. Rename it to `mai_trollcity.jpeg` (lowercase recommended) so the file path is `/mai_trollcity.jpeg`.

Example (Windows PowerShell):

    copy "C:\Users\justk\Downloads\Screenshot_6-8-2025_184649_looka.com.jpeg" .\mai_trollcity.jpeg

Or move it (recommended for cleanliness):

    move "C:\Users\justk\Downloads\Screenshot_6-8-2025_184649_looka.com.jpeg" .\mai_trollcity.jpeg

Why this matters:
- The home page hero expects the image at `/mai_trollcity.jpeg` (served from the `public` folder).
- If no image is found, a semi-transparent overlay will be shown instead to avoid breaking layout.

If you prefer another name, update `src/pages/Home.jsx` image `src` value accordingly.
