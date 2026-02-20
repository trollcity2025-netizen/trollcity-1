import React from 'react';
import { Link } from 'react-router-dom';
import { trollCityTheme } from '@/styles/trollCityTheme';

const CityHallPage: React.FC = () => {
  return (
    <div className={`p-6 ${trollCityTheme.backgrounds.primary} text-white min-h-screen flex flex-col items-center justify-center text-center`}>
      <h1 className="text-5xl font-bold mb-4">Under Construction</h1>
      <p className="text-xl text-zinc-400 mb-8">The City Hall is currently being rebuilt and will be back soon.</p>
      <Link to="/" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
        Back to Home
      </Link>
    </div>
  );
};

export default CityHallPage;
