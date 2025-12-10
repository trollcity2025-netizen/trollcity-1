// src/pages/CreatorContractPage.jsx
import React from "react";
import { TrollTractCard } from "../components/trolltract/TrollTractCard";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Crown, Coins, Trophy } from "lucide-react";

export default function CreatorContractPage() {
  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="w-8 h-8 text-yellow-300" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            TrollTract Creator Contract
          </h1>
          <p className="text-sm text-purple-100/80">
            Join Troll City’s official creator ranks. Unlock payouts and
            premium tools by activating your contract.
          </p>
        </div>
      </div>

      <TrollTractCard />

      <Card className="bg-slate-900/70 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <Trophy className="w-5 h-5 text-yellow-300" />
            What You Get as a TrollTract Creator
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm text-slate-100/90">
          <div>
            <p className="font-semibold mb-1">Monetization</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Access to cash payouts via your payout page</li>
              <li>Boosted earnings multiplier on qualifying gifts</li>
              <li>Track coins, Trollmonds, and income in one place</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">Visibility & Status</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Priority in Troll City discovery & rankings</li>
              <li>Eligible for featured shows and Troll events</li>
              <li>Seen as an official Troll City broadcaster</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">Requirements</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>One-time contract fee: 20,000 paid coins</li>
              <li>Abide by Troll City rules and officer decisions</li>
              <li>Maintain good standing with the community</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">Recommended Strategy</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Warm up your audience before signing</li>
              <li>Schedule regular shows (Tromody, battles, etc.)</li>
              <li>Collaborate with Troll Officers & Troll Families</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-purple-900/30 border-purple-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-300" />
            How the 20,000 Paid Coins Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-purple-50/90">
          <p>
            The contract cost is a one-time permanent unlock. You keep earning
            forever as long as your account stays in good standing.
          </p>
          <p className="text-xs text-purple-100/80">
            Troll City may update contract perks in the future to add more
            benefits, events, and exclusive features for early TrollTract
            creators.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}