import numpy as np

from app.operators.thresholding.adaptive_threshold import AdaptiveThreshold
from app.operators.thresholding.apply_threshold import ApplyThreshold
from app.operators.thresholding.otsu_threshold import OtsuThreshold

# ApplyThreshold


class TestApplyThreshold:
    def test_default_params_output_shape(self, color_image):
        result = ApplyThreshold({}).compute(color_image)
        assert result.shape == color_image.shape

    def test_output_is_uint8(self, color_image):
        result = ApplyThreshold({}).compute(color_image)
        assert result.dtype == np.uint8

    def test_default_max_value_produces_black_output(self, color_image):
        result = ApplyThreshold({}).compute(color_image)
        assert result.max() == 0

    def test_max_value_255_produces_binary_output(self, grayscale_image):
        result = ApplyThreshold({"maxValue": 255, "thresholdValue": 127}).compute(grayscale_image)
        unique = np.unique(result)
        assert set(unique).issubset({0, 255})

    def test_threshold_value_0_with_max_255_sets_all_pixels(self, grayscale_image):
        result = ApplyThreshold({"maxValue": 255, "thresholdValue": 0}).compute(grayscale_image)
        assert result.max() == 255

    def test_grayscale_input(self, grayscale_image):
        result = ApplyThreshold({"maxValue": 255, "thresholdValue": 127}).compute(grayscale_image)
        assert result.shape == grayscale_image.shape


# AdaptiveThreshold


class TestAdaptiveThreshold:
    def test_default_params_output_shape(self, color_image):
        result = AdaptiveThreshold({}).compute(color_image)
        assert result.shape == color_image.shape[:2]

    def test_output_is_uint8(self, color_image):
        result = AdaptiveThreshold({}).compute(color_image)
        assert result.dtype == np.uint8

    def test_output_is_binary(self, color_image):
        result = AdaptiveThreshold({}).compute(color_image)
        unique = np.unique(result)
        assert set(unique).issubset({0, 255})

    def test_color_input_converts_to_grayscale(self, color_image):
        result = AdaptiveThreshold({}).compute(color_image)
        assert len(result.shape) == 2

    def test_rgba_input(self, color_image):
        rgba = np.dstack([color_image, np.full(color_image.shape[:2], 255, dtype=np.uint8)])
        result = AdaptiveThreshold({}).compute(rgba)
        assert len(result.shape) == 2

    def test_even_block_size_corrected_to_odd(self, color_image):
        result_even = AdaptiveThreshold({"blockSize": 4}).compute(color_image)
        result_odd = AdaptiveThreshold({"blockSize": 5}).compute(color_image)
        np.testing.assert_array_equal(result_even, result_odd)

    def test_gaussian_method(self, color_image):
        result = AdaptiveThreshold({"adaptiveMethod": "GAUSSIAN"}).compute(color_image)
        assert result.shape == color_image.shape[:2]

    def test_mean_method(self, color_image):
        result = AdaptiveThreshold({"adaptiveMethod": "MEAN"}).compute(color_image)
        assert result.shape == color_image.shape[:2]

    def test_grayscale_input(self, grayscale_image):
        result = AdaptiveThreshold({}).compute(grayscale_image)
        assert result.shape == grayscale_image.shape


# OtsuThreshold


class TestOtsuThreshold:
    def test_default_params_output_shape(self, color_image):
        result = OtsuThreshold({}).compute(color_image)
        assert result.shape == color_image.shape[:2]

    def test_output_is_uint8(self, color_image):
        result = OtsuThreshold({}).compute(color_image)
        assert result.dtype == np.uint8

    def test_output_is_binary(self, color_image):
        result = OtsuThreshold({}).compute(color_image)
        unique = np.unique(result)
        assert set(unique).issubset({0, 255})

    def test_color_input_converts_to_grayscale(self, color_image):
        result = OtsuThreshold({}).compute(color_image)
        assert len(result.shape) == 2

    def test_grayscale_input(self, grayscale_image):
        result = OtsuThreshold({}).compute(grayscale_image)
        assert result.shape == grayscale_image.shape

    def test_custom_max_value(self, grayscale_image):
        result = OtsuThreshold({"maxValue": 128}).compute(grayscale_image)
        unique = np.unique(result)
        assert set(unique).issubset({0, 128})
