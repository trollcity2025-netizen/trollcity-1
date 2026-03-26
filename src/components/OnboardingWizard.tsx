import React, { useState } from 'react';

interface Step {
  title: string;
  content: string;
}

const OnboardingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = [
    { title: 'Welcome', content: 'Welcome to TrollCity! Let\'s get you started.' },
    { title: 'Profile Setup', content: 'Please set up your profile information.' },
    { title: 'Terms & Conditions', content: 'Review and accept our terms of service.' },
    { title: 'Complete', content: 'You\'re all set! Enjoy your experience.' }
  ];

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const finishWizard = () => {
    // Handle finish logic, e.g., close modal or navigate
    console.log('Onboarding completed');
  };

  return (
    <div className="onboarding-wizard bg-slate-900 p-6 rounded-lg shadow-lg max-w-md mx-auto border border-white/10">
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full ${
                index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        <h2 className="text-xl font-bold text-white">{steps[currentStep].title}</h2>
      </div>
      <div className="mb-6">
        <p className="text-gray-300">{steps[currentStep].content}</p>
      </div>
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="px-4 py-2 bg-slate-700 text-gray-300 rounded disabled:opacity-50"
        >
          Previous
        </button>
        {currentStep < steps.length - 1 ? (
          <button
            onClick={nextStep}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Next
          </button>
        ) : (
          <button
            onClick={finishWizard}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;