import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Session from '../models/Session.js';
import { validatePassword, validateEmail, validateUsername } from '../utils/validation.js';
import { ValidationError, ConflictError } from '../utils/errorHandler.js';

const ACCESS_TOKEN_TTL = '30m';
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;

export const signUp = async (req, res, next) => {
    try {
        const { username, email, password, lastName, firstName } = req.body;

        // Validate required fields
        if (!username || !email || !password || !lastName || !firstName) {
            throw new ValidationError('Tất cả các trường đều bắt buộc');
        }

        // Validate username, email, and password
        validateUsername(username);
        validateEmail(email);
        validatePassword(password);

        // Check for existing username
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            throw new ConflictError('Tên đăng nhập đã tồn tại');
        }

        // Check for existing email
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            throw new ConflictError('Email đã tồn tại');
        }

        const newUser = await User.create({
            username,
            email,
            hashedPassword: password,
            displayName: `${firstName} ${lastName}`,
        });

        return res.status(201).json({
            message: 'Đăng ký thành công',
            user: newUser.toPublicProfile()
        });
    } catch (error) {
        // Handle MongoDB duplicate key error as fallback
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            if (field === 'username') {
                return next(new ConflictError('Tên đăng nhập đã tồn tại'));
            } else if (field === 'email') {
                return next(new ConflictError('Email đã tồn tại'));
            } else if (field === 'phone') {
                return next(new ConflictError('Số điện thoại đã tồn tại'));
            }
        }
        next(error);
    }
};

export const signIn = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            throw new ValidationError('Tên đăng nhập và mật khẩu là bắt buộc');
        }

        const user = await User.findOne({ username }).select('+hashedPassword');

        if (!user) {
            throw new ValidationError('Tên đăng nhập hoặc mật khẩu không đúng');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new ValidationError('Tên đăng nhập hoặc mật khẩu không đúng');
        }

        const accessToken = jwt.sign(
            { userId: user._id },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: ACCESS_TOKEN_TTL }
        );

        const refreshToken = crypto.randomBytes(64).toString('hex');

        await Session.create({
            userId: user._id,
            refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL)
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: REFRESH_TOKEN_TTL
        });

        return res.status(200).json({
            message: 'Đăng nhập thành công',
            user: user.toPublicProfile(),
            accessToken
        });
    } catch (error) {
        next(error);
    }
};

export const signOut = async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (refreshToken) {
            await Session.deleteOne({ refreshToken });
            res.clearCookie('refreshToken');
        }

        return res.status(200).json({ message: 'Đăng xuất thành công' });
    } catch (error) {
        next(error);
    }
};

export const refresh = async (req, res, next) => {
    try {
        const oldRefreshToken = req.cookies?.refreshToken;

        if (!oldRefreshToken) {
            throw new ValidationError('Refresh token không tồn tại');
        }

        const session = await Session.findOne({ refreshToken: oldRefreshToken });
        if (!session) {
            throw new ValidationError('Refresh token không hợp lệ');
        }

        if (session.expiresAt < new Date()) {
            await Session.deleteOne({ refreshToken: oldRefreshToken });
            throw new ValidationError('Refresh token đã hết hạn');
        }

        const user = await User.findById(session.userId);
        if (!user) {
            throw new ValidationError('Người dùng không tồn tại');
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { userId: user._id },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: ACCESS_TOKEN_TTL }
        );

        // Rotate refresh token - create new one and delete old one
        const newRefreshToken = crypto.randomBytes(64).toString('hex');
        
        // Delete old session
        await Session.deleteOne({ refreshToken: oldRefreshToken });
        
        // Create new session with new refresh token
        await Session.create({
            userId: user._id,
            refreshToken: newRefreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL)
        });

        // Set new refresh token cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: REFRESH_TOKEN_TTL
        });

        return res.status(200).json({
            message: 'Làm mới token thành công',
            accessToken
        });
    } catch (error) {
        next(error);
    }
};
