using UnrealBuildTool;

public class LudusMarkdown : ModuleRules
{
	public LudusMarkdown(ReadOnlyTargetRules Target) : base(Target)
	{
		bUsePrecompiled = true;
		PrecompileForTargets = PrecompileTargetsType.Any;
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		CppStandard = CppStandardVersion.Latest;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"LudusCore",
			"EditorSubsystem",
			"UnrealEd"
		});

	}
}
