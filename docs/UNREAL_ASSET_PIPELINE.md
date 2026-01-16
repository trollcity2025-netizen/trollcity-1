# Unreal Engine Asset Pipeline for Troll City

This guide explains how to use your high-quality Unreal Engine assets (renders/screenshots) in the Troll City web application. This allows users to see the exact visual representation of cars and houses they are buying in the Marketplace and Dealership.

## 1. Vehicle Images (Cars)

The web app displays vehicle images in the Dealership, Inventory, and Auction House.

### Steps to Import:
1.  **Capture in Unreal**: Take a high-quality screenshot or render of your vehicle on a transparent background (PNG).
    *   Recommended resolution: 800x600 or 1024x768.
    *   Ensure the car is centered and lit evenly.
2.  **Naming**: Name the file according to the `image` path defined in `src/data/vehicles.ts`.
    *   Example: `troll_compact_s1.png`
    *   Example: `titan_enforcer.png`
3.  **Place File**: Move the PNG file to:
    ```
    public/assets/cars/
    ```
4.  **Verify**: Open `src/data/vehicles.ts` and ensure the `image` property matches your filename.

```typescript
// src/data/vehicles.ts
{
  id: 8,
  name: 'Titan Enforcer',
  // ...
  image: '/assets/cars/titan_enforcer.png' // <--- Matches your file
}
```

## 2. House Images

The web app uses a single "collage" image to display the different house tiers in the "Buy Home" menu.

### Steps to Import:
1.  **Capture in Unreal**: Take screenshots of each house tier (Starter, Mid, Apartment, Luxury, Mansion, Mega).
2.  **Create Collage**: Create a single image named `house_options.jpg` with the following grid layout:
    *   **Row 1**: Starter | Mid | Apartment
    *   **Row 2**: Luxury | Mansion | Mega
    *   *Note: Each cell maps to a specific background position in the CSS.*
3.  **Place File**: Move the file to:
    ```
    public/assets/house_options.jpg
    ```
4.  **Verify**: The `HomeVisual` component in `src/pages/TrollsTownPage.tsx` will automatically load this image.

## 3. Other Assets

If you have other items (like garage interiors or specific props):
1.  Create a new folder in `public/assets/` (e.g., `public/assets/props/`).
2.  Add your images.
3.  Update the relevant component or data file to point to the new path.

## 4. 3D World Integration (Advanced)

Currently, the web 3D world (`TrollsTown3DPage.tsx`) uses procedural low-poly models for performance.
To use Unreal models in the web 3D view:
1.  **Export**: Export your Unreal meshes as `.glb` or `.gltf` files.
2.  **Import**: Update `TrollsTown3DPage.tsx` to load these meshes using `SceneLoader.ImportMesh`.
3.  *Note: This requires optimization as high-poly Unreal assets may lag in a web browser.*
