/**
 * File: src/pages/GetHelp.tsx
 * Get Help page - Support, documentation, and resources
 * Based on Figma screenshot
 */

import React from "react";
import { showToast } from "../utils/toast";
import {
  HelpCircle,
  BookOpen,
  PlayCircle,
  Calendar,
  Sparkles,
  Share2,
} from "lucide-react";

interface HelpCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  action: () => void;
  showSocial?: boolean;
}

export const GetHelp: React.FC = () => {
  const handleRaiseTicket = () => {
    showToast("Opening support ticket form...", "info");
  };

  const handleViewGuide = () => {
    showToast("Opening documentation...", "info");
  };

  const handleWatchVideos = () => {
    showToast("Opening video tutorials...", "info");
  };

  const handleBookDemo = () => {
    showToast("Opening demo booking...", "info");
  };

  const handleSubmitIdea = () => {
    showToast("Opening feature request form...", "info");
  };

  const handleSocialClick = (platform: string) => {
    showToast(`Opening ${platform}...`, "info");
  };

  const helpCards: HelpCard[] = [
    {
      id: "support",
      icon: <HelpCircle className="w-8 h-8 text-blue-600" />,
      title: "Get Support",
      description:
        "Need help? Raise a support ticket and our team will get back to you soon.",
      buttonText: "Raise a Ticket",
      action: handleRaiseTicket,
    },
    {
      id: "documentation",
      icon: <BookOpen className="w-8 h-8 text-blue-600" />,
      title: "Documentation",
      description:
        "Follow easy guides to learn and use Kavin Invoice features step by step.",
      buttonText: "View Guide",
      action: handleViewGuide,
    },
    {
      id: "videos",
      icon: <PlayCircle className="w-8 h-8 text-blue-600" />,
      title: "Video Tutorials",
      description:
        "Watch helpful videos to learn how to use features and manage your billing.",
      buttonText: "Watch Videos",
      action: handleWatchVideos,
    },
    {
      id: "demo",
      icon: <Calendar className="w-8 h-8 text-blue-600" />,
      title: "Schedule a Demo",
      description:
        "Book a session to take a hands-on Invoice Ins your business and get setup help.",
      buttonText: "Book a Seat",
      action: handleBookDemo,
    },
    {
      id: "feature",
      icon: <Sparkles className="w-8 h-8 text-blue-600" />,
      title: "Request a Feature",
      description:
        "Share your ideas, tips and others suggested, and follow our product roadmap.",
      buttonText: "Submit Idea",
      action: handleSubmitIdea,
    },
    {
      id: "social",
      icon: <Share2 className="w-8 h-8 text-blue-600" />,
      title: "Follow Us",
      description:
        "Follow us on social media to get updates, tips, and connect with our team.",
      buttonText: "",
      action: () => {},
      showSocial: true,
    },
  ];

  return (
    <div className="module-page-shell overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Get Help
          </h1>
          <p className="text-sm text-gray-600">We are here to help you</p>
        </div>

        {/* Help Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {helpCards.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                {card.icon}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                {card.description}
              </p>

              {/* Action Button or Social Links */}
              {card.showSocial ? (
                <div className="flex items-center gap-3">
                  {/* Facebook */}
                  <button
                    onClick={() => handleSocialClick("Facebook")}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </button>

                  {/* Instagram */}
                  <button
                    onClick={() => handleSocialClick("Instagram")}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-pink-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => handleSocialClick("LinkedIn")}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-blue-700"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </button>

                  {/* X (Twitter) */}
                  <button
                    onClick={() => handleSocialClick("X")}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-gray-900"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={card.action}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                >
                  {card.buttonText}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
