import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getSchedules } from "../../services/scheduleService";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { ArrowLeft, Download, Copy, MapPin, CalendarDays, Activity, QrCode, AlertCircle } from "lucide-react";

export default function ParentQRCode() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reservation, setReservation] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [permanentQueueNumber, setPermanentQueueNumber] = useState(null);

  useEffect(() => {
    let unsubReservations;
    
    const initializeData = async () => {
      try {
        const schedulesData = await getSchedules();
        
        unsubReservations = subscribeToAllReservations((data) => {
          const currentRes = data.find(r => r.id === id);
          
          if (!currentRes) {
            setLoading(false);
            return;
          }

          // Security check
          if (user && currentRes.parentId !== user.uid) {
            toast.error("Unauthorized access.");
            navigate("/parent/reservations");
            return;
          }

          // Calculate permanent queue number
          const scheduleRes = data.filter(r => r.scheduleId === currentRes.scheduleId)
            .sort((a, b) => a.createdAt - b.createdAt);
          const index = scheduleRes.findIndex(r => r.id === currentRes.id);
          setPermanentQueueNumber(index >= 0 ? index + 1 : null);

          setReservation(currentRes);
          if (schedulesData && currentRes.scheduleId) {
            setSchedule(schedulesData[currentRes.scheduleId]);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    if (user) {
      initializeData();
    }

    return () => {
      if (unsubReservations) unsubReservations();
    };
  }, [id, user, navigate]);

  useEffect(() => {
    if (reservation && reservation.reservationCode) {
      const payload = {
        reservationId: reservation.id,
        reservationCode: reservation.reservationCode,
      };

      QRCode.toDataURL(JSON.stringify(payload), {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e3a8a', // blue-900
          light: '#ffffff'
        }
      })
      .then(url => {
        setQrImageUrl(url);
      })
      .catch(err => {
        console.error("Failed to generate QR:", err);
      });
    }
  }, [reservation]);

  const handleCopyCode = () => {
    if (reservation?.reservationCode) {
      navigator.clipboard.writeText(reservation.reservationCode);
      toast.success("Reservation Code copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!reservation || !schedule) {
    return (
      <div className="p-6 text-center text-gray-500">
        Reservation not found.
        <button onClick={() => navigate("/parent/reservations")} className="block mx-auto mt-4 text-blue-600 font-semibold">
          Back to Reservations
        </button>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'reserved': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'waiting': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'validated': return 'bg-green-50 text-green-600 border-green-100';
      case 'completed': return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'cancelled': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 pb-10">
      <button 
        onClick={() => navigate("/parent/reservations")}
        className="flex items-center text-gray-500 hover:text-gray-800 transition-colors font-semibold mb-6"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Reservations
      </button>

      <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-center">
          <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Reservation Key</h1>
          <p className="text-blue-100 text-sm font-medium">
            {reservation.status === "checked_in" ? "Already Validated" : 
             reservation.status === "in_consultation" ? "Currently In Consultation" :
             reservation.status === "consultation_completed" ? "Consultation Completed" :
             "Scan this at the clinic"}
          </p>
        </div>

        {/* Not Started / Paused Warnings */}
        {schedule?.queueStatus === 'not_started' && (
          <div className="bg-amber-50 p-5 border-b border-amber-100 text-center">
            <div className="flex items-center justify-center text-amber-700 font-bold mb-2">
              <Activity className="w-5 h-5 mr-2" />
              Clinic Queue Not Started
            </div>
            <p className="text-amber-800 text-sm">
              The doctor hasn't started today's clinic queue yet. You may reserve your slot, but QR validation will only be available once the clinic queue begins.
            </p>
          </div>
        )}
        {schedule?.queueStatus === 'paused' && (
          <div className="bg-orange-50 p-5 border-b border-orange-100 text-center">
            <div className="flex items-center justify-center text-orange-700 font-bold mb-2">
              <AlertCircle className="w-5 h-5 mr-2" />
              Queue Paused
            </div>
            <p className="text-orange-800 text-sm">
              The clinic queue is temporarily paused. Please wait until the doctor resumes today's clinic.
            </p>
          </div>
        )}
        {schedule?.queueStatus === 'closed' && (
          <div className="bg-amber-50 p-4 border-b border-amber-100 text-center">
            <div className="flex items-center justify-center text-amber-800 font-bold mb-1 text-sm">
              <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
              Queue Closed to New Reservations
            </div>
            <p className="text-amber-700 text-xs">
              Your existing reservation is valid. You may still present this QR code to the secretary for validation.
            </p>
          </div>
        )}

        {/* QR Section */}
        <div className="p-8 text-center flex flex-col items-center border-b border-gray-50">
          {schedule?.queueStatus === 'ended' || schedule?.queueStatus === 'completed' ? (
            <div className="py-8 px-4 text-center w-full">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <X className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Clinic Closed</h2>
              <p className="text-gray-500 text-sm mt-2 font-medium">Today's clinic session has ended. Your reservation remains available in history.</p>
            </div>
          ) : ["in_consultation", "consultation_completed"].includes(reservation.status) ? (
            <div className="py-8 px-4 text-center w-full">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <Activity className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {reservation.status === "in_consultation" ? "Currently In Consultation" : "Consultation Completed"}
              </h2>
              {reservation.status === "consultation_completed" && (
                <p className="text-gray-500 text-sm mt-2 font-medium">View details in Reservation History.</p>
              )}
            </div>
          ) : (
            <>
              {qrImageUrl ? (
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-6 relative">
                  <img src={qrImageUrl} alt="Reservation QR Code" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                  {reservation.status === "checked_in" && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                      <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl font-bold shadow-sm border border-green-200">
                        Already Validated
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 bg-gray-50 rounded-2xl border border-gray-100 mb-6 flex items-center justify-center text-gray-400">
                  Generating...
                </div>
              )}
              
              <div className="mb-2">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Reservation Code</span>
                <div className="text-4xl font-black text-gray-800 tracking-wider mt-1">{reservation.reservationCode || "------"}</div>
              </div>
              
              <button 
                onClick={handleCopyCode}
                className="flex items-center text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg mt-2 transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Code
              </button>
            </>
          )}
        </div>

        {/* Details Section */}
        <div className="p-6 bg-gray-50/50">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center text-gray-600 font-medium">
                <MapPin className="w-4 h-4 mr-2 text-gray-400" /> Branch
              </div>
              <div className="font-bold text-gray-800">{schedule.branch}</div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center text-gray-600 font-medium">
                <CalendarDays className="w-4 h-4 mr-2 text-gray-400" /> Date
              </div>
              <div className="font-bold text-gray-800">
                {new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <div className="flex items-center text-gray-600 font-medium">
                <Activity className="w-4 h-4 mr-2 text-gray-400" /> Queue Number
              </div>
              <div className="font-black text-blue-600 text-xl">{permanentQueueNumber ? `#${permanentQueueNumber}` : "-"}</div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center text-gray-600 font-medium">Status</div>
              <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${getStatusColor(reservation.status)}`}>
                {reservation.status}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-0 bg-gray-50/50">
          {qrImageUrl && schedule?.queueStatus !== 'ended' && schedule?.queueStatus !== 'completed' && reservation.status !== "in_consultation" && reservation.status !== "consultation_completed" && reservation.status !== "checked_in" && (
            <a 
              href={qrImageUrl} 
              download={`reservation-${reservation.reservationCode || 'code'}.png`}
              className="w-full flex items-center justify-center py-3.5 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-colors shadow-sm"
            >
              <Download className="w-5 h-5 mr-2" />
              Download QR Code
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
