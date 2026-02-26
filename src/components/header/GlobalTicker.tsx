
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Gift, Home, Gavel, Trophy, Megaphone, Cloud, Newspaper } from 'lucide-react';

const iconMap = {
  gift: <Gift className="w-4 h-4 text-pink-400" />,
  property: <Home className="w-4 h-4 text-green-400" />,
  jail: <Gavel className="w-4 h-4 text-red-400" />,
  talent: <Trophy className="w-4 h-4 text-yellow-400" />,
  announcement: <Megaphone className="w-4 h-4 text-cyan-400" />,
  weather: <Cloud className="w-4 h-4 text-blue-400" />,
  news: <Newspaper className="w-4 h-4 text-gray-400" />,
};

const GlobalTicker = () => {
  const [trollCityEvents, setTrollCityEvents] = useState<any[]>([]);
  const [weatherEvent, setWeatherEvent] = useState<any>(null);
  const [newsEvents, setNewsEvents] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);

  // Fetch user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation permission denied. Weather will not be available.', error);
        }
      );
    }
  }, []);

  // Fetch weather when location is available
  useEffect(() => {
    if (location) {
      const fetchWeather = async () => {
        try {
          const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
          if (!apiKey) {
            setWeatherEvent({
              id: 'weather-error',
              type: 'weather',
              title: 'OpenWeatherMap API Key is missing. Please set it in your environment variables.',
              icon: 'weather',
              priority: 3,
            });
            return;
          }
          const url = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${apiKey}&units=metric`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (response.ok) {
            const weather = {
              id: `weather-${Date.now()}`,
              type: 'weather',
              title: `Weather in ${data.name}: ${data.main.temp.toFixed(0)}°C, ${data.weather[0].description}`,
              icon: 'weather',
              priority: 1,
            };
            setWeatherEvent(weather);
          } else {
            console.error('Failed to fetch weather:', data.message);
          }
        } catch (error) {
          console.error('Error fetching weather:', error);
        }
      };

      fetchWeather();
      // Fetch weather every 15 minutes
      const interval = setInterval(fetchWeather, 15 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [location]);

  // Fetch news headlines
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const apiKey = import.meta.env.VITE_NEWSAPI_API_KEY;
        if (!apiKey) {
          console.warn('NewsAPI key is missing.');
          return;
        }
        const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok && data.articles) {
          const formattedNews = data.articles.map((article: any, index: number) => ({
            id: `news-${index}-${Date.now()}`,
            type: 'news',
            title: article.title,
            icon: 'news',
            priority: 1,
          }));
          setNewsEvents(formattedNews);
        } else {
          console.error('Failed to fetch news:', data.message);
        }
      } catch (error) {
        console.error('Error fetching news:', error);
      }
    };

    fetchNews();
    // Fetch news every 30 minutes
    const interval = setInterval(fetchNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Troll City events
  useEffect(() => {
    const fetchInitialEvents = async () => {
      const { data, error } = await supabase
        .from('global_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) console.error('Error fetching global events:', error);
      else setTrollCityEvents(data || []);
    };

    fetchInitialEvents();

    const channel = supabase
      .channel('global-events-ticker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_events' }, (payload) => {
        setTrollCityEvents(currentEvents => [payload.new, ...currentEvents].slice(0, 20));
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Merge all event sources
  const mergedEvents = useMemo(() => {
    const interleaved = [];
    const maxLength = Math.max(trollCityEvents.length, newsEvents.length);

    if (weatherEvent) {
      interleaved.push(weatherEvent);
    }

    for (let i = 0; i < maxLength; i++) {
      if (newsEvents[i]) interleaved.push(newsEvents[i]);
      if (trollCityEvents[i]) interleaved.push(trollCityEvents[i]);
    }

    return interleaved;
  }, [trollCityEvents, newsEvents, weatherEvent]);

  if (mergedEvents.length === 0) {
    return null; // Don't render anything if there are no events
  }

  return (
    <div className="relative w-full h-10 flex items-center overflow-hidden bg-slate-900/50 border-y border-white/10 backdrop-blur-sm">
      <div className="animate-marquee-continuous whitespace-nowrap flex items-center gap-8 px-4">
        {mergedEvents.map((event, index) => (
          <div key={`${event.id}-${index}`} className="flex items-center gap-2 text-sm text-slate-300">
            {iconMap[event.icon as keyof typeof iconMap] || <Megaphone className="w-4 h-4 text-cyan-400" />}
            <span 
              className={cn({
                'font-bold text-white': event.priority >= 2,
                'text-yellow-400 glow-medium': event.priority === 2,
                'text-red-500 glow-high': event.priority === 3,
              })}
            >
              {event.title}
            </span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-slate-950 pointer-events-none" />
    </div>
  );
};

export default GlobalTicker;
