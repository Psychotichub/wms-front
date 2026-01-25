import { useState, useEffect, useCallback } from 'react';
import { kvStorage } from '../utils/storage';
import { useAuth } from '../context/AuthContext';

const WIDGET_PREFERENCES_KEY = 'dashboard_widget_preferences';

// Default widget visibility
const DEFAULT_WIDGETS = {
  overview: true,
  productivityKPIs: false,
  workTrends: false,
  topPerformers: false,
  quickActions: true,
  mapView: false,
};

export const useWidgetPreferences = () => {
  const { user } = useAuth();
  const userId = user?.id || user?._id || user?.email || 'default';
  const storageKey = `${WIDGET_PREFERENCES_KEY}:${userId}`;
  
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [loading, setLoading] = useState(true);

  // Load preferences from storage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const stored = await kvStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          setWidgets({ ...DEFAULT_WIDGETS, ...parsed });
        }
      } catch (error) {
        console.error('Failed to load widget preferences:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, [storageKey]);

  // Save preferences to storage
  const savePreferences = useCallback(async (newWidgets) => {
    try {
      await kvStorage.setItem(storageKey, JSON.stringify(newWidgets));
      setWidgets(newWidgets);
    } catch (error) {
      console.error('Failed to save widget preferences:', error);
      throw error;
    }
  }, [storageKey]);

  // Toggle a specific widget
  const toggleWidget = useCallback(async (widgetKey) => {
    const newWidgets = {
      ...widgets,
      [widgetKey]: !widgets[widgetKey],
    };
    await savePreferences(newWidgets);
  }, [widgets, savePreferences]);

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    await savePreferences(DEFAULT_WIDGETS);
  }, [savePreferences]);

  return {
    widgets,
    loading,
    toggleWidget,
    savePreferences,
    resetToDefaults,
  };
};
