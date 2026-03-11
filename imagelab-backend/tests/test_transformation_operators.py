import numpy as np
import pytest

from app.operators.transformation.distance_transform import DistanceTransform
from app.operators.transformation.laplacian import Laplacian


@pytest.fixture
def color_image():
    return np.random.randint(0, 256, (100, 100, 3), dtype=np.uint8)


@pytest.fixture
def grayscale_image():
    return np.random.randint(0, 256, (100, 100), dtype=np.uint8)


@pytest.fixture
def binary_image():
    img = np.zeros((100, 100), dtype=np.uint8)
    img[20:80, 20:80] = 255
    return img


@pytest.fixture
def binary_color_image():
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img[20:80, 20:80] = 255
    return img


class TestDistanceTransform:
    def test_default_params_output_shape(self, binary_color_image):
        result = DistanceTransform({}).compute(binary_color_image)
        assert result.shape == (100, 100)

    def test_output_is_uint8(self, binary_color_image):
        result = DistanceTransform({}).compute(binary_color_image)
        assert result.dtype == np.uint8

    def test_output_normalized_to_0_255(self, binary_color_image):
        result = DistanceTransform({}).compute(binary_color_image)
        assert result.min() >= 0
        assert result.max() <= 255

    def test_grayscale_input_accepted(self, binary_image):
        result = DistanceTransform({}).compute(binary_image)
        assert result.dtype == np.uint8
        assert result.shape == (100, 100)

    def test_blank_image_returns_all_zeros(self):
        blank = np.zeros((50, 50, 3), dtype=np.uint8)
        result = DistanceTransform({}).compute(blank)
        assert result.max() == 0

    def test_fully_white_image_returns_all_zeros(self):
        white = np.full((50, 50, 3), 255, dtype=np.uint8)
        result = DistanceTransform({}).compute(white)
        assert result.max() == 0

    def test_dist_l1_produces_output(self, binary_color_image):
        result = DistanceTransform({"type": "DIST_L1"}).compute(binary_color_image)
        assert result.dtype == np.uint8
        assert result.shape == (100, 100)

    def test_dist_l2_produces_output(self, binary_color_image):
        result = DistanceTransform({"type": "DIST_L2"}).compute(binary_color_image)
        assert result.dtype == np.uint8

    def test_dist_c_produces_output(self, binary_color_image):
        result = DistanceTransform({"type": "DIST_C"}).compute(binary_color_image)
        assert result.dtype == np.uint8

    def test_different_distance_types_produce_valid_output(self, binary_color_image):
        for dist_type in ["DIST_C", "DIST_L1", "DIST_L2"]:
            result = DistanceTransform({"type": dist_type}).compute(binary_color_image)
            assert result.dtype == np.uint8
            assert result.shape == (100, 100)
            assert result.min() >= 0
            assert result.max() <= 255

    def test_unknown_type_falls_back_to_l2(self, binary_color_image):
        result_unknown = DistanceTransform({"type": "INVALID"}).compute(binary_color_image)
        result_l2 = DistanceTransform({"type": "DIST_L2"}).compute(binary_color_image)
        np.testing.assert_array_equal(result_unknown, result_l2)

    def test_does_not_mutate_input(self, binary_color_image):
        original = binary_color_image.copy()
        DistanceTransform({}).compute(binary_color_image)
        np.testing.assert_array_equal(binary_color_image, original)

    def test_interior_pixels_have_higher_distance_than_border(self, binary_color_image):
        result = DistanceTransform({"type": "DIST_L2"}).compute(binary_color_image)
        centre_val = int(result[50, 50])
        edge_val = int(result[20, 50])
        assert centre_val > edge_val


class TestLaplacian:
    def test_default_params_output_shape(self, color_image):
        result = Laplacian({}).compute(color_image)
        assert result.shape == color_image.shape

    def test_output_is_uint8(self, color_image):
        result = Laplacian({}).compute(color_image)
        assert result.dtype == np.uint8

    def test_grayscale_input_accepted(self, grayscale_image):
        result = Laplacian({}).compute(grayscale_image)
        assert result.dtype == np.uint8
        assert result.shape == grayscale_image.shape

    def test_uniform_image_produces_zero_output(self):
        uniform = np.full((50, 50, 3), 128, dtype=np.uint8)
        result = Laplacian({}).compute(uniform)
        assert result.max() == 0

    def test_edge_pixels_have_high_response(self):
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        img[30:70, 30:70] = 255
        result = Laplacian({}).compute(img)
        assert result[30, 50].any() or result[29, 50].any()

    def test_output_values_in_valid_uint8_range(self, color_image):
        result = Laplacian({}).compute(color_image)
        assert result.min() >= 0
        assert result.max() <= 255

    def test_does_not_mutate_input(self, color_image):
        original = color_image.copy()
        Laplacian({}).compute(color_image)
        np.testing.assert_array_equal(color_image, original)

    def test_output_shape_matches_input_for_non_square_image(self):
        img = np.random.randint(0, 256, (60, 120, 3), dtype=np.uint8)
        result = Laplacian({}).compute(img)
        assert result.shape == img.shape
