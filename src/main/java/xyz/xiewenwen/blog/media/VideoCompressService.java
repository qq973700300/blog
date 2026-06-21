package xyz.xiewenwen.blog.media;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class VideoCompressService {

	private static final int AUDIO_BITRATE = 64_000;

	private final String ffmpegBin;
	private final String ffprobeBin;
	private final long transcodeTimeoutMinutes;
	private final long targetMaxBytes;

	public VideoCompressService(
			@Value("${blog.ffmpeg.bin:ffmpeg}") String ffmpegBin,
			@Value("${blog.ffprobe.bin:ffprobe}") String ffprobeBin,
			@Value("${blog.video.transcode-timeout-minutes:45}") long transcodeTimeoutMinutes,
			@Value("${blog.video.compress-target-bytes:52428800}") long targetMaxBytes) {
		this.ffmpegBin = ffmpegBin;
		this.ffprobeBin = ffprobeBin;
		this.transcodeTimeoutMinutes = transcodeTimeoutMinutes;
		this.targetMaxBytes = targetMaxBytes;
	}

	public void compressToTarget(Path input, Path output, long inputSizeBytes)
			throws IOException, InterruptedException {
		if (!Files.exists(input)) {
			throw new IOException("源文件不存在");
		}

		double duration = probeDurationSeconds(input);
		if (duration <= 0) {
			throw new IOException("无法读取视频时长");
		}

		Files.createDirectories(output.getParent());
		if (Files.exists(output)) {
			Files.delete(output);
		}

		int maxWidth = pickWidth(inputSizeBytes, duration);
		long videoBitrate = computeVideoBitrate(duration);
		encode(input, output, maxWidth, videoBitrate);

		if (Files.size(output) <= targetMaxBytes) {
			return;
		}

		Files.deleteIfExists(output);
		encode(input, output, 426, Math.max(150_000, videoBitrate / 2));
		if (Files.size(output) > targetMaxBytes) {
			throw new IOException("压缩后仍超过 " + (targetMaxBytes / (1024 * 1024)) + "MB，请上传更短的视频");
		}
	}

	private int pickWidth(long inputSizeBytes, double durationSec) {
		if (inputSizeBytes > 350L * 1024 * 1024 || durationSec > 600) {
			return 426;
		}
		if (inputSizeBytes > 250L * 1024 * 1024 || durationSec > 300) {
			return 480;
		}
		return 640;
	}

	private long computeVideoBitrate(double durationSec) {
		long audioBitsTotal = (long) (AUDIO_BITRATE * (durationSec + 1));
		long budgetBits = targetMaxBytes * 8 - audioBitsTotal - 48_000;
		long videoBitrate = (long) (budgetBits / durationSec);
		return Math.max(150_000, Math.min(videoBitrate, 4_000_000));
	}

	private void encode(Path input, Path output, int maxWidth, long videoBitrate)
			throws IOException, InterruptedException {
		long maxrate = (long) (videoBitrate * 1.1);
		long bufsize = videoBitrate * 2;
		String vf = "scale='min(" + maxWidth + ",iw)':-2:force_original_aspect_ratio=decrease,fps=24";

		List<String> cmd = new ArrayList<>();
		cmd.add(ffmpegBin);
		cmd.add("-hide_banner");
		cmd.add("-loglevel");
		cmd.add("error");
		cmd.add("-y");
		cmd.add("-threads");
		cmd.add("2");
		cmd.add("-i");
		cmd.add(input.toString());
		cmd.add("-vf");
		cmd.add(vf);
		cmd.add("-c:v");
		cmd.add("libx264");
		cmd.add("-preset");
		cmd.add("ultrafast");
		cmd.add("-tune");
		cmd.add("fastdecode");
		cmd.add("-b:v");
		cmd.add(Long.toString(videoBitrate));
		cmd.add("-maxrate");
		cmd.add(Long.toString(maxrate));
		cmd.add("-bufsize");
		cmd.add(Long.toString(bufsize));
		cmd.add("-c:a");
		cmd.add("aac");
		cmd.add("-b:a");
		cmd.add("64k");
		cmd.add("-ar");
		cmd.add("44100");
		cmd.add("-movflags");
		cmd.add("+faststart");
		cmd.add("-pix_fmt");
		cmd.add("yuv420p");
		cmd.add(output.toString());

		run(cmd, transcodeTimeoutMinutes);
		if (!Files.exists(output) || Files.size(output) == 0) {
			throw new IOException("FFmpeg 未生成输出文件");
		}
	}

	private double probeDurationSeconds(Path input) throws IOException, InterruptedException {
		List<String> cmd = List.of(
				ffprobeBin,
				"-v", "error",
				"-show_entries", "format=duration",
				"-of", "default=noprint_wrappers=1:nokey=1",
				input.toString());
		Process process = new ProcessBuilder(cmd)
				.redirectError(ProcessBuilder.Redirect.DISCARD)
				.redirectOutput(ProcessBuilder.Redirect.PIPE)
				.start();
		boolean finished = process.waitFor(2, TimeUnit.MINUTES);
		if (!finished) {
			process.destroyForcibly();
			throw new IOException("ffprobe 超时");
		}
		if (process.exitValue() != 0) {
			throw new IOException("ffprobe 失败");
		}
		String line;
		try (InputStream in = process.getInputStream()) {
			line = new String(in.readAllBytes()).trim();
		}
		if (line.isBlank()) {
			return -1;
		}
		return Double.parseDouble(line);
	}

	private void run(List<String> cmd, long timeoutMinutes) throws IOException, InterruptedException {
		Process process = new ProcessBuilder(cmd)
				.redirectError(ProcessBuilder.Redirect.DISCARD)
				.redirectOutput(ProcessBuilder.Redirect.DISCARD)
				.start();
		boolean finished = process.waitFor(timeoutMinutes, TimeUnit.MINUTES);
		if (!finished) {
			process.destroyForcibly();
			throw new IOException("FFmpeg 转码超时");
		}
		if (process.exitValue() != 0) {
			throw new IOException("FFmpeg 转码失败");
		}
	}

	public void ensureFfmpegAvailable() throws IOException {
		try {
			Process p = new ProcessBuilder(ffmpegBin, "-version")
					.redirectError(ProcessBuilder.Redirect.DISCARD)
					.redirectOutput(ProcessBuilder.Redirect.DISCARD)
					.start();
			if (!p.waitFor(30, TimeUnit.SECONDS) || p.exitValue() != 0) {
				throw new IOException("ffmpeg 不可用");
			}
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw new IOException("ffmpeg 检查被中断");
		}
	}
}
