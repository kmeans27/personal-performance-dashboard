from datetime import time

from pulse import scoring as s


def test_clamp01():
    assert s.clamp01(-3) == 0.0
    assert s.clamp01(0.4) == 0.4
    assert s.clamp01(9) == 1.0


def test_ramp_higher_and_lower():
    assert s.ramp(0, 0, 10) == 0.0
    assert s.ramp(5, 0, 10) == 0.5
    assert s.ramp(10, 0, 10) == 1.0
    assert s.ramp(15, 0, 10) == 1.0
    # inverted ramp: low value is the good one
    assert s.lower_is_better(3, good=3, bad=7) == 1.0
    assert s.lower_is_better(5, good=3, bad=7) == 0.5
    assert s.lower_is_better(8, good=3, bad=7) == 0.0


def test_plateau_rewards_the_band():
    assert s.plateau(8, 7, 9, 2) == 1.0
    assert s.plateau(7, 7, 9, 2) == 1.0
    assert s.plateau(6, 7, 9, 2) == 0.5
    assert s.plateau(5, 7, 9, 2) == 0.0
    assert s.plateau(10, 7, 9, 2) == 0.5
    assert s.plateau(None, 7, 9, 2) is None


def test_boolean_and_counts():
    assert s.boolean(True) == 1.0
    assert s.boolean(False) == 0.0
    assert s.boolean(None) is None
    assert s.count_toward(3, 2) == 1.0  # capped
    assert s.count_toward(1, 2) == 0.5


def test_sleep_regularity_needs_history():
    assert s.sleep_regularity([time(23, 0)] * 3) is None


def test_sleep_regularity_consistent_beats_chaotic():
    tight = s.sleep_regularity([time(23, 0), time(23, 10), time(22, 50), time(23, 5), time(23, 0)])
    loose = s.sleep_regularity([time(21, 30), time(1, 30), time(23, 0), time(3, 0), time(22, 0)])
    assert tight is not None and loose is not None
    assert tight > 0.9
    assert loose < tight
