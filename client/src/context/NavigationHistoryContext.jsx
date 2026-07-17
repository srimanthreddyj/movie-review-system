import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType, useNavigate } from 'react-router-dom';

const NavigationHistoryContext = createContext(null);

export const useNavigationHistory = () => {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error('useNavigationHistory must be used within a NavigationHistoryProvider');
  }
  return context;
};

export const NavigationHistoryProvider = ({ children }) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();

  // stateCache stores the states of pages keyed by location.key
  const stateCacheRef = useRef({});
  // historyStack tracks pathnames indexed by browser history's index (idx)
  const [historyStack, setHistoryStack] = useState([]);

  // Load cache from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('app_nav_history_state');
      if (stored) {
        stateCacheRef.current = JSON.parse(stored);
      }
      
      const storedStack = sessionStorage.getItem('app_nav_history_stack');
      if (storedStack) {
        setHistoryStack(JSON.parse(storedStack));
      }
    } catch (e) {
      console.error('Failed to load navigation history from sessionStorage:', e);
    }

    // Set scroll restoration to manual so the browser doesn't conflict with our manual restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  const saveToSessionStorage = () => {
    try {
      sessionStorage.setItem('app_nav_history_state', JSON.stringify(stateCacheRef.current));
    } catch (e) {
      console.error('Failed to save navigation history to sessionStorage:', e);
    }
  };

  const getPageState = (key) => {
    return stateCacheRef.current[key] || null;
  };

  const setPageState = (key, state) => {
    if (!key) return;
    stateCacheRef.current[key] = {
      ...stateCacheRef.current[key],
      ...state,
      pathname: location.pathname
    };
    saveToSessionStorage();
  };

  // Synchronize historyStack with browser state index (idx)
  useEffect(() => {
    const currentIdx = window.history.state?.idx || 0;
    setHistoryStack((prev) => {
      const nextStack = [...prev];
      nextStack[currentIdx] = location.pathname;
      const sliced = nextStack.slice(0, currentIdx + 1);
      
      try {
        sessionStorage.setItem('app_nav_history_stack', JSON.stringify(sliced));
      } catch (e) {
        console.error('Failed to save history stack:', e);
      }
      return sliced;
    });
  }, [location.pathname]);

  const goBack = (fallbackPath = '/') => {
    // If there is browser history within our app, go back
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  };

  const getBackLabel = (fallbackLabel = 'Back') => {
    const currentIdx = window.history.state?.idx || 0;
    if (currentIdx <= 0) return fallbackLabel;

    const previousPath = historyStack[currentIdx - 1];
    if (!previousPath) return fallbackLabel;

    if (previousPath === '/movies') {
      return 'Back to Catalogue';
    } else if (previousPath.startsWith('/movies/')) {
      return 'Back to Movie details';
    } else if (previousPath === '/cast') {
      return 'Back to Cast profiles';
    } else if (previousPath.startsWith('/cast/')) {
      return 'Back to Cast profile';
    } else if (previousPath === '/collections') {
      return 'Back to Collections';
    } else if (previousPath === '/favourites') {
      return 'Back to Favourites';
    } else if (previousPath === '/clips') {
      return 'Back to Clips';
    }
    
    return fallbackLabel;
  };

  return (
    <NavigationHistoryContext.Provider
      value={{
        getPageState,
        setPageState,
        goBack,
        getBackLabel,
        location,
        navigationType,
        historyStack
      }}
    >
      {children}
    </NavigationHistoryContext.Provider>
  );
};

// Custom Hook to manage local states of lists
export const useRestorePageState = (pageId, defaultState, loading = false) => {
  const { getPageState, setPageState, location } = useNavigationHistory();
  const currentKey = location.key || 'default';
  const hasRestoredRef = useRef(false);

  const [state, setStateInternal] = useState(() => {
    const saved = getPageState(currentKey);
    if (saved && saved.pageId === pageId) {
      hasRestoredRef.current = true;
      return { ...defaultState, ...saved.data };
    }
    return defaultState;
  });

  // Wrapped state setter that updates cache synchronously
  const setState = (newValue) => {
    setStateInternal((prev) => {
      const nextState = typeof newValue === 'function' ? newValue(prev) : newValue;
      setPageState(currentKey, {
        pageId,
        data: nextState
      });
      return nextState;
    });
  };

  // Save scroll position on unmount and scroll events
  useEffect(() => {
    const handleScroll = () => {
      setPageState(currentKey, {
        scrollY: window.scrollY
      });
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      setPageState(currentKey, {
        scrollY: window.scrollY
      });
    };
  }, [currentKey]);

  // Restore scroll position when loading is false
  const [scrollRestored, setScrollRestored] = useState(false);

  useEffect(() => {
    setScrollRestored(false);
  }, [currentKey]);

  useEffect(() => {
    if (!loading && !scrollRestored) {
      const saved = getPageState(currentKey);
      if (saved && typeof saved.scrollY === 'number') {
        setScrollRestored(true);
        const scroll = () => {
          window.scrollTo({
            top: saved.scrollY,
            behavior: 'instant'
          });
        };
        // Progressive scrolling to handle rendering lag
        scroll();
        const t1 = setTimeout(scroll, 50);
        const t2 = setTimeout(scroll, 150);
        const t3 = setTimeout(scroll, 300);
        const t4 = setTimeout(scroll, 500);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
          clearTimeout(t4);
        };
      }
    }
  }, [loading, currentKey, scrollRestored]);

  return [state, setState];
};
