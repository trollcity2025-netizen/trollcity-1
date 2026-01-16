# Ludus AI (Unreal Plugin)

This repository contains a `LudusAI` Unreal Engine plugin folder.

## Correct Location

Unreal projects load project plugins from a `Plugins/` directory next to your `.uproject` file:

- `<YourUnrealProjectRoot>/Plugins/LudusAI/LudusAI.uplugin`

In this workspace, the plugin files are available at:

- `Plugins/LudusAI/LudusAI.uplugin`

If your Unreal project lives somewhere else, copy the entire `Plugins/LudusAI/` folder into that Unreal project root.

## Enable in Unreal

- Open the project in Unreal Editor.
- If prompted to rebuild missing modules, choose Yes.
- Go to `Edit → Plugins`.
- Search for `Ludus` / `Ludus AI`.
- Enable it and restart the editor.

## C++ Projects (if applicable)

- Right-click the `.uproject` file → `Generate Visual Studio project files`.
- Open the generated `.sln` in Visual Studio.
- Build `Development Editor`.

## Common Pitfalls

- No `.uproject` next to `Plugins/`: the plugin will not load.
- Plugin folder depth: make sure the `.uplugin` is directly inside `Plugins/LudusAI/` (not nested deeper).
- Engine version mismatch: open `Plugins/LudusAI/LudusAI.uplugin` and make sure `EngineVersion` matches your Unreal version, or remove that key entirely.
- Incomplete plugin: if the `.uplugin` lists `Modules`, the plugin should include a `Source/` folder (or prebuilt `Binaries/`). If you only have `Resources/` + `.uplugin`, re-download the full plugin package.
- Windows download blocking: right-click the `.uplugin` (and the plugin folder zip, if applicable) → `Properties` → `Unblock`.
- Caching: close Unreal, delete `<Project>/Intermediate` and `<Project>/Binaries` (project, not engine), then reopen.
