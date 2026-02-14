import React, { useState, useEffect, useCallback } from 'react';
import { useRepossession } from '../../lib/hooks/useRepossession';
import { useAuthStore } from '../../lib/store';

interface RepossessionPanelProps {
  targetUserId?: string;
  onClose?: () => void;
}

export function RepossessionPanel({ targetUserId, onClose }: RepossessionPanelProps) {
  const { profile } = useAuthStore();
  const {
    loading,
    delinquentUsers,
    fetchDelinquentUsers,
    getUserAssets,
    repossessProperty,
    repossessVehicle,
    issueLoanDefaultSummon,
    restoreRepossessedAsset: _restoreRepossessedAsset,
  } = useRepossession();

  const [selectedUser, setSelectedUser] = useState<string>(targetUserId || '');
  const [userAssets, setUserAssets] = useState<any>(null);
  const [summonReason, setSummonReason] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'property' | 'vehicle' | 'summon';
    id: string;
    name: string;
  } | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.is_admin || profile?.role === 'lead_troll_officer';

  const handleFetchAssets = useCallback(async (userId: string) => {
    const result = await getUserAssets(userId);
    if (result.success) {
      setUserAssets(result.data);
    }
  }, [getUserAssets]);

  useEffect(() => {
    if (isAdmin) {
      fetchDelinquentUsers();
    }
    if (targetUserId) {
      handleFetchAssets(targetUserId);
    }
  }, [isAdmin, targetUserId, fetchDelinquentUsers, handleFetchAssets]);

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId);
    handleFetchAssets(userId);
  };

  const handleRepossessProperty = async (propertyId: string, propertyName: string) => {
    setConfirmAction({ type: 'property', id: propertyId, name: propertyName });
    setShowConfirmModal(true);
  };

  const handleRepossessVehicle = async (vehicleId: string, vehicleName: string) => {
    setConfirmAction({ type: 'vehicle', id: vehicleId, name: vehicleName });
    setShowConfirmModal(true);
  };

  const handleIssueSummon = async (userId: string, summonType: string) => {
    const result = await issueLoanDefaultSummon(
      userId,
      summonType as any,
      summonReason || 'Loan default - Court appearance required'
    );
    if (result.success) {
      setSummonReason('');
      fetchDelinquentUsers();
    }
  };

  const confirmRepossession = async () => {
    if (!confirmAction) return;

    let result;
    if (confirmAction.type === 'property') {
      result = await repossessProperty(confirmAction.id, `Loan default - Property repossessed`);
    } else if (confirmAction.type === 'vehicle') {
      result = await repossessVehicle(confirmAction.id, `Loan default - Vehicle repossessed`);
    }

    if (result?.success) {
      if (selectedUser) {
        handleFetchAssets(selectedUser);
      }
      fetchDelinquentUsers();
    }

    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  if (!isAdmin) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="repossession-panel p-4 bg-gray-100 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Repossession Management</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
          >
            Close
          </button>
        )}
      </div>

      {/* Delinquent Users List */}
      {!targetUserId && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Users with Delinquent Loans</h3>
          {loading ? (
            <p>Loading...</p>
          ) : delinquentUsers.length === 0 ? (
            <p className="text-gray-500">No delinquent users found.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {delinquentUsers.map((user: any) => (
                <div
                  key={user.user_id}
                  className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${
                    selectedUser === user.user_id ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleSelectUser(user.user_id)}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{user.username}</span>
                    <span className="text-red-600">
                      {Number(user.total_balance || 0).toLocaleString()} coins
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Properties: {user.owned_properties?.length || 0} | 
                    Vehicles: {user.owned_vehicles?.length || 0}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Assets */}
      {selectedUser && userAssets && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">User Assets</h3>

          {/* Properties */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Properties</h4>
            {userAssets.properties?.length === 0 ? (
              <p className="text-gray-500 text-sm">No properties owned.</p>
            ) : (
              <div className="space-y-2">
                {userAssets.properties?.map((prop: any) => (
                  <div
                    key={prop.id}
                    className={`p-3 border rounded-lg ${
                      prop.is_repossessed ? 'bg-red-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{prop.property_name}</span>
                        {prop.is_repossessed && (
                          <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded">
                            REPOSSESSED
                          </span>
                        )}
                      </div>
                      {!prop.is_repossessed && (
                        <button
                          onClick={() => handleRepossessProperty(prop.id, prop.property_name)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Repossess
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vehicles */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Vehicles</h4>
            {userAssets.vehicles?.length === 0 ? (
              <p className="text-gray-500 text-sm">No vehicles owned.</p>
            ) : (
              <div className="space-y-2">
                {userAssets.vehicles?.map((veh: any) => (
                  <div
                    key={veh.id}
                    className={`p-3 border rounded-lg ${
                      veh.is_repossessed ? 'bg-red-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{veh.vehicles_catalog?.name}</span>
                        {veh.is_repossessed && (
                          <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded">
                            REPOSSESSED
                          </span>
                        )}
                      </div>
                      {!veh.is_repossessed && (
                        <button
                          onClick={() => handleRepossessVehicle(veh.id, veh.vehicles_catalog?.name)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Repossess
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Loans */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Active Loans</h4>
            {userAssets.loans?.length === 0 ? (
              <p className="text-gray-500 text-sm">No active loans.</p>
            ) : (
              <div className="space-y-2">
                {userAssets.loans?.map((loan: any) => (
                  <div key={loan.id} className="p-3 border rounded-lg bg-yellow-50">
                    <div className="flex justify-between">
                      <span>Balance: {Number(loan.balance || 0).toLocaleString()} coins</span>
                      <span className="text-sm">
                        Due: {new Date(loan.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Court Summons Actions */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Court Summons Actions</h4>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Reason for summon (optional)"
                value={summonReason}
                onChange={(e) => setSummonReason(e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleIssueSummon(selectedUser, 'loan_default_hearing')}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Issue Loan Default Summon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-red-600">Confirm Repossession</h3>
            <p className="mb-4">
              Are you sure you want to repossess {confirmAction.name}?
              This action will:
            </p>
            <ul className="list-disc list-inside mb-4 text-sm">
              <li>Remove ownership from the user</li>
              <li>Create an instant court summon</li>
              <li>Log the action for audit purposes</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={confirmRepossession}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm Repossession
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RepossessionPanel;
