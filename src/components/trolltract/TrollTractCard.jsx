// src/components/trolltract/TrollTractCard.jsx
import React, { useEffect, useState } from "react";
import { Coins, CheckCircle, Crown, Target, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
  fetchMyTrolltractStatus,
  purchaseTrolltract,
} from "../../lib/trolltractApi";

export function TrollTractCard() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      setLoadingStatus(true);
      try {
        const data = await fetchMyTrolltractStatus();
        setStatus(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStatus(false);
      }
    };

    loadStatus();
  }, []);

  const handlePurchase = async () => {
    setBuying(true);
    try {
      const result = await purchaseTrolltract();

      if (result === "already_contracted") {
        toast("You are already a TrollTract Creator.");
      } else if (result === "insufficient_funds") {
        toast.error("Not enough paid coins. You need 20,000 paid coins.");
      } else if (result === "success") {
        toast.success("Contract activated! You are now a TrollTract Creator.");
        const data = await fetchMyTrolltractStatus();
        setStatus(data);
      } else {
        toast.error("Unexpected response from server.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not activate contract. Try again.");
    } finally {
      setBuying(false);
    }
  };

  if (loadingStatus) {
    return (
      <Card className="bg-purple-900/40 border-purple-500">
        <CardHeader>
          <CardTitle>Loading TrollTract status...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const isContracted = status?.is_contracted;

  if (isContracted) {
    return (
      <Card className="bg-green-500/15 border-green-500/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-300">
            <CheckCircle className="w-5 h-5" />
            TrollTract Creator Active
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-green-100/90">
          <p>
            You are officially contracted with Troll City. Payouts and creator
            tools are unlocked.
          </p>
          {status?.contract_signed_at && (
            <p>
              <span className="font-semibold">Signed:</span>{" "}
              {new Date(status.contract_signed_at).toLocaleString()}
            </p>
          )}
          {status?.earnings_multiplier && (
            <p className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Earnings Multiplier:{" "}
              <span className="font-semibold">
                {Math.round(Number(status.earnings_multiplier) * 100)}%
              </span>
            </p>
          )}
          {status?.goal_monthly_coins && (
            <p className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              Monthly Goal:{" "}
              <span className="font-semibold">
                {status.goal_monthly_coins.toLocaleString()} coins
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-purple-900/40 border-purple-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-100">
          <Crown className="w-5 h-5 text-yellow-300" />
          TrollTract Creator Contract
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-purple-50/90">
        <p>
          Become an official <span className="font-semibold">Troll City</span>{" "}
          contracted broadcaster. Unlock payouts, rankings, and boosted
          earnings.
        </p>

        <ul className="list-disc list-inside space-y-1 text-xs text-purple-100/80">
          <li>One-time cost: 20,000 paid coins</li>
          <li>Unlocks cash payouts & creator dashboard</li>
          <li>10% earnings boost on qualifying gifts</li>
          <li>Priority in Troll City rankings & events</li>
        </ul>

        <div className="flex items-center gap-2 text-xl font-bold text-yellow-300">
          <Coins className="w-5 h-5" />
          20,000 Paid Coins
        </div>

        <Button
          className="w-full mt-2"
          onClick={handlePurchase}
          disabled={buying}
        >
          {buying ? "Activating..." : "Activate TrollTract Contract"}
        </Button>
      </CardContent>
    </Card>
  );
}