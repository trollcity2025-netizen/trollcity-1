import React, { useState } from 'react';
import { createMarketplaceReview, uploadReviewImage, deleteReviewImage } from '../lib/sellerApi';
import type { MarketplaceReview, CreateReviewInput } from '../lib/sellerTiers';
import SellerTierBadge from './SellerTierBadge';

interface ReviewCardProps {
  review: MarketplaceReview;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
            {review.buyer_avatar ? (
              <img src={review.buyer_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                {review.buyer_username?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white">
              {review.buyer_username || 'Anonymous'}
            </span>
            {review.is_verified_purchase && (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                ✓ Verified Purchase
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            {renderStars(review.rating)}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDate(review.created_at)}
            </span>
          </div>

          {review.comment && (
            <p className="mt-2 text-gray-700 dark:text-gray-300">{review.comment}</p>
          )}

          {/* Review Images */}
          {review.images && review.images.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {review.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Review image ${idx + 1}`}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              ))}
            </div>
          )}

          {/* Additional Ratings */}
          {review.delivery_rating && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Delivery: {renderStars(review.delivery_rating)}
            </div>
          )}

          {/* Recommendation */}
          <div className="mt-2 flex items-center gap-4">
            {review.would_recommend !== null && (
              <span className={`text-sm ${review.would_recommend ? 'text-green-600' : 'text-red-600'}`}>
                {review.would_recommend ? '✓ Would Recommend' : '✗ Would Not Recommend'}
              </span>
            )}
            {review.item_as_described !== null && (
              <span className={`text-sm ${review.item_as_described ? 'text-green-600' : 'text-red-600'}`}>
                {review.item_as_described ? '✓ Item as Described' : '✗ Not as Described'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReviewFormProps {
  orderId: string;
  sellerId: string;
  buyerId: string;
  listingId?: string;
  listingType?: 'marketplace' | 'vehicle' | 'service';
  onSuccess?: (result: any) => void;
  onCancel?: () => void;
}

export function ReviewForm({
  orderId,
  sellerId,
  buyerId,
  listingId,
  listingType = 'marketplace',
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [deliveryRating, setDeliveryRating] = useState<number | null>(null);
  const [itemAsDescribed, setItemAsDescribed] = useState(true);
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const result = await uploadReviewImage(files[i], buyerId);
        uploadedUrls.push(result.url);
      }
      setImages([...images, ...uploadedUrls]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (url: string) => {
    try {
      await deleteReviewImage(url);
      setImages(images.filter((img) => img !== url));
    } catch (err: any) {
      console.error('Failed to delete image:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const input: CreateReviewInput = {
        order_id: orderId,
        seller_id: sellerId,
        buyer_id: buyerId,
        listing_id: listingId,
        listing_type: listingType,
        rating,
        comment: comment || undefined,
        images: images.length > 0 ? images : undefined,
        delivery_rating: deliveryRating || undefined,
        item_as_described: itemAsDescribed,
        would_recommend: wouldRecommend,
      };

      const result = await createMarketplaceReview(input);
      if (result.success) {
        onSuccess?.(result);
      } else {
        setError('Failed to submit review');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Leave a Review
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {/* Star Rating */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Overall Rating *
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="focus:outline-none"
            >
              <svg
                className={`w-8 h-8 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Rating */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Delivery Experience (optional)
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setDeliveryRating(star)}
              className="focus:outline-none"
            >
              <svg
                className={`w-6 h-6 ${star <= (deliveryRating || 0) ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Item as Described */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Item as Described
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="itemAsDescribed"
              checked={itemAsDescribed}
              onChange={() => setItemAsDescribed(true)}
              className="mr-2"
            />
            <span className="text-green-600">✓ Yes</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="itemAsDescribed"
              checked={!itemAsDescribed}
              onChange={() => setItemAsDescribed(false)}
              className="mr-2"
            />
            <span className="text-red-600">✗ No</span>
          </label>
        </div>
      </div>

      {/* Would Recommend */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Would Recommend
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="wouldRecommend"
              checked={wouldRecommend}
              onChange={() => setWouldRecommend(true)}
              className="mr-2"
            />
            <span className="text-green-600">✓ Yes</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="wouldRecommend"
              checked={!wouldRecommend}
              onChange={() => setWouldRecommend(false)}
              className="mr-2"
            />
            <span className="text-red-600">✗ No</span>
          </label>
        </div>
      </div>

      {/* Comment */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Review Comment (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this seller..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          rows={4}
          maxLength={1000}
        />
      </div>

      {/* Images */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Add Photos (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative">
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => handleRemoveImage(url)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <span className="text-xs text-gray-500">Uploading...</span>
            ) : (
              <span className="text-2xl text-gray-400">+</span>
            )}
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
}

/**
 * Seller rating summary component
 */
interface SellerRatingSummaryProps {
  rating: number | null;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
}

export function SellerRatingSummary({
  rating,
  totalReviews,
  positiveReviews,
  negativeReviews,
}: SellerRatingSummaryProps) {
  const positivePercent = totalReviews > 0 ? Math.round((positiveReviews / totalReviews) * 100) : 0;

  return (
    <div className="bg-slate-900 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-4">
        {/* Average Rating */}
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-900 dark:text-white">
            {rating ? rating.toFixed(1) : 'N/A'}
          </div>
          <div className="flex justify-center mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-5 h-5 ${star <= Math.round(rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalReviews} reviews
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {positivePercent}% Positive
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${positivePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{positiveReviews} positive</span>
            <span>{negativeReviews} negative</span>
          </div>
        </div>
      </div>
    </div>
  );
}
