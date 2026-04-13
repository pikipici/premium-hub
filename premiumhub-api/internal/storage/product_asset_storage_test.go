package storage

import "testing"

func TestValidateProductAssetDimensionsIcon(t *testing.T) {
	t.Parallel()

	if err := validateProductAssetDimensions(productAssetKindIcon, 512, 512); err != nil {
		t.Fatalf("icon 512x512 should be valid, got: %v", err)
	}

	if err := validateProductAssetDimensions(productAssetKindIcon, 300, 200); err == nil {
		t.Fatalf("icon non-square should be rejected")
	}

	if err := validateProductAssetDimensions(productAssetKindIcon, 128, 128); err == nil {
		t.Fatalf("icon below minimum size should be rejected")
	}
}

func TestValidateProductAssetDimensionsHero(t *testing.T) {
	t.Parallel()

	if err := validateProductAssetDimensions(productAssetKindHero, 1600, 900); err != nil {
		t.Fatalf("hero 16:9 should be valid, got: %v", err)
	}

	if err := validateProductAssetDimensions(productAssetKindHero, 1200, 900); err == nil {
		t.Fatalf("hero non 16:9 should be rejected")
	}

	if err := validateProductAssetDimensions(productAssetKindHero, 1024, 576); err == nil {
		t.Fatalf("hero below minimum size should be rejected")
	}
}
