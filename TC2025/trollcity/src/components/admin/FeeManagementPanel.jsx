import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Plus, Edit, Trash2, Save, X, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FEES as STATIC_FEES } from '@/lib/fees';

export default function FeeManagementPanel({ currentUser }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('platform');
  const [newFee, setNewFee] = useState({
    code: '',
    name: '',
    amount: 0,
    category: 'platform',
    description: '',
    is_active: true
  });

  // Fetch custom fees from database
  const { data: customFees = [], isLoading } = useQuery({
    queryKey: ['customFees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .order('category', { ascending: true })
        .order('code', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch fee categories
  const { data: feeCategories = [] } = useQuery({
    queryKey: ['feeCategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Create new fee mutation
  const createFeeMutation = useMutation({
    mutationFn: async (feeData) => {
      const { error } = await supabase
        .from('fees')
        .insert({
          ...feeData,
          created_by: currentUser?.id,
          created_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customFees']);
      toast.success('Fee created successfully');
      setShowAddForm(false);
      setNewFee({
        code: '',
        name: '',
        amount: 0,
        category: 'platform',
        description: '',
        is_active: true
      });
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to create fee');
    }
  });

  // Update fee mutation
  const updateFeeMutation = useMutation({
    mutationFn: async (feeData) => {
      const { error } = await supabase
        .from('fees')
        .update({
          ...feeData,
          updated_by: currentUser?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', feeData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customFees']);
      toast.success('Fee updated successfully');
      setIsEditing(false);
      setEditingFee(null);
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update fee');
    }
  });

  // Delete fee mutation
  const deleteFeeMutation = useMutation({
    mutationFn: async (feeId) => {
      const { error } = await supabase
        .from('fees')
        .delete()
        .eq('id', feeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customFees']);
      toast.success('Fee deleted successfully');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete fee');
    }
  });

  // Get all fees (static + custom)
  const getAllFees = () => {
    const staticFees = Object.entries(STATIC_FEES).map(([code, amount]) => ({
      id: `static_${code}`,
      code,
      name: formatFeeName(code),
      amount,
      category: 'platform',
      description: getFeeDescription(code),
      is_active: true,
      is_static: true
    }));

    const combinedFees = [...staticFees, ...customFees];
    return combinedFees.filter(fee => fee.category === activeTab || activeTab === 'all');
  };

  // Format fee name for display
  const formatFeeName = (code) => {
    return code.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Get fee description
  const getFeeDescription = (code) => {
    const descriptions = {
      kick: 'Fee for kicking a user from stream',
      ban: 'Fee for banning a user',
      ban3x: 'Fee for 3x ban (extended ban)',
      family_create: 'Fee for creating a new family',
      message_admin: 'Fee for sending messages to admin',
      disable_chat: 'Fee for disabling chat',
      racism_lock: 'Fee for racism-related locks'
    };
    return descriptions[code] || 'Platform fee';
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newFee.code || !newFee.name || newFee.amount < 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    createFeeMutation.mutate(newFee);
  };

  // Handle edit
  const handleEdit = (fee) => {
    setEditingFee(fee);
    setIsEditing(true);
  };

  // Handle update
  const handleUpdate = (feeData) => {
    updateFeeMutation.mutate(feeData);
  };

  // Handle delete
  const handleDelete = (feeId) => {
    if (feeId.startsWith('static_')) {
      toast.error('Cannot delete static platform fees');
      return;
    }
    if (window.confirm('Are you sure you want to delete this fee?')) {
      deleteFeeMutation.mutate(feeId);
    }
  };

  // Get total fees by category
  const getCategoryTotals = () => {
    const allFees = getAllFees();
    const totals = {};
    allFees.forEach(fee => {
      if (!totals[fee.category]) totals[fee.category] = 0;
      totals[fee.category] += fee.amount;
    });
    return totals;
  };

  if (isLoading) {
    return (
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span className="ml-2 text-gray-400">Loading fees...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1a24] border-[#2a2a3a]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <DollarSign className="w-5 h-5" />
          Fee Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Category Overview */}
        <div className="mb-6 p-4 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg">
          <h3 className="text-white font-semibold mb-3">Fee Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(getCategoryTotals()).map(([category, total]) => (
              <div key={category} className="text-center">
                <p className="text-2xl font-bold text-purple-400">{total.toLocaleString()}</p>
                <p className="text-xs text-gray-400 capitalize">{category} Total</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs for different fee categories */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-[#0a0a0f]">
            <TabsTrigger value="platform">Platform Fees</TabsTrigger>
            <TabsTrigger value="stream">Stream Fees</TabsTrigger>
            <TabsTrigger value="premium">Premium Fees</TabsTrigger>
            <TabsTrigger value="custom">Custom Fees</TabsTrigger>
            <TabsTrigger value="all">All Fees</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {/* Fee Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2a2a3a]">
                    <TableHead className="text-gray-300">Code</TableHead>
                    <TableHead className="text-gray-300">Name</TableHead>
                    <TableHead className="text-gray-300">Amount</TableHead>
                    <TableHead className="text-gray-300">Category</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">Type</TableHead>
                    <TableHead className="text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getAllFees().map((fee) => (
                    <TableRow key={fee.id} className="border-[#2a2a3a]">
                      <TableCell className="text-white font-mono text-sm">{fee.code}</TableCell>
                      <TableCell className="text-white">{fee.name}</TableCell>
                      <TableCell className="text-purple-400 font-semibold">{fee.amount.toLocaleString()} coins</TableCell>
                      <TableCell>
                        <Badge className="bg-purple-600 text-white capitalize">{fee.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {fee.is_active ? (
                          <Badge className="bg-green-600 text-white">Active</Badge>
                        ) : (
                          <Badge className="bg-red-600 text-white">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {fee.is_static ? (
                          <Badge className="bg-blue-600 text-white">Static</Badge>
                        ) : (
                          <Badge className="bg-yellow-600 text-white">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {!fee.is_static && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(fee)}
                                className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(fee.id)}
                                className="border-red-500 text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Add New Fee Button */}
            <div className="flex justify-between items-center">
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Fee
              </Button>
              
              <div className="text-sm text-gray-400">
                Total {getAllFees().length} fees • {getAllFees().filter(f => !f.is_static).length} custom
              </div>
            </div>

            {/* Add Fee Form */}
            {showAddForm && (
              <Card className="bg-[#0a0a0f] border-[#2a2a3a]">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Add New Fee</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300">Fee Code *</Label>
                        <Input
                          type="text"
                          value={newFee.code}
                          onChange={(e) => setNewFee({ ...newFee, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                          placeholder="e.g., custom_fee"
                          className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Fee Name *</Label>
                        <Input
                          type="text"
                          value={newFee.name}
                          onChange={(e) => setNewFee({ ...newFee, name: e.target.value })}
                          placeholder="e.g., Custom Platform Fee"
                          className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Amount (coins) *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={newFee.amount}
                          onChange={(e) => setNewFee({ ...newFee, amount: parseInt(e.target.value) || 0 })}
                          placeholder="100"
                          className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Category</Label>
                        <Select
                          value={newFee.category}
                          onValueChange={(value) => setNewFee({ ...newFee, category: value })}
                        >
                          <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="platform">Platform</SelectItem>
                            <SelectItem value="stream">Stream</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-300">Description</Label>
                      <Input
                        type="text"
                        value={newFee.description}
                        onChange={(e) => setNewFee({ ...newFee, description: e.target.value })}
                        placeholder="Description of what this fee is for"
                        className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={createFeeMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {createFeeMutation.isPending ? 'Creating...' : 'Create Fee'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        variant="outline"
                        className="border-[#2a2a3a] text-gray-300 hover:bg-[#1a1a24]"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}